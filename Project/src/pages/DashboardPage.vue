<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { userPath } from '@shared/user-links'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Activity, ApiResponse, Dashboard, ListResponse } from '@shared/contracts'
import { api, errorMessage } from '@/services/api'
import { communityService } from '@/services/community'
import { subscribeRealtime } from '@/services/realtime'
import { useAuthStore } from '@/stores/auth'
import Icon from '@/components/ui/Icon.vue'
import Avatar from '@/components/ui/Avatar.vue'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import WorldMap, { type MapPoint } from '@/components/WorldMap.vue'
import CommunityTagFilter from '@/components/features/CommunityTagFilter.vue'
import { useCommunityTags } from '@/composables/useCommunityTags'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const dashboard = ref<Dashboard | null>(null)
const dashboardError = ref('')
const geographyError = ref('')
const points = ref<MapPoint[]>([])
const { ranked: rankedTags, loading: tagsLoading, error: tagsError, refresh: refreshTags } = useCommunityTags()
const mapLoading = ref(false)
const q = ref(String(route.query.q || ''))
const selectedTags = ref(String(route.query.tag || '').split(',').filter(Boolean))
const activity = ref<Activity[]>([])
const activityPage = ref(1)
const activityPages = ref(1)
const activityError = ref('')
const activityLoading = ref(false)
let mapController: AbortController | undefined
let debounce: ReturnType<typeof setTimeout> | undefined
let unsubscribe: (() => void) | undefined
let disposed = false
const matchingCount = computed(() => points.value.reduce((sum, point) => sum + point.count, 0))
const metrics = computed(() => [
  { label: 'Участников в Klan', value: dashboard.value?.stats.users ?? '—', sub: 'Один круг. Общие ценности.', icon: 'users' },
  { label: 'Городов на карте', value: dashboard.value?.stats.cities ?? '—', sub: 'Своих найдёшь везде', icon: 'location-dot' },
  { label: 'Мероприятий в месяце', value: dashboard.value?.stats.events ?? '—', sub: 'Поводы встретиться', icon: 'calendar-days' },
  { label: 'Активных команд', value: dashboard.value?.stats.teams ?? '—', sub: 'Вместе можно больше', icon: 'shield-halved' },
])
const month = new Intl.DateTimeFormat('ru', {month:'long', year:'numeric'}).format(new Date()).replace(' г.','')
const nextEvent = computed(() => dashboard.value?.events[0])
function date(value?: string) { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('ru', {day:'numeric',month:'short'}).format(d) }
function time(value: string) { return new Intl.DateTimeFormat('ru', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) }
function progress(start?: string, end?: string) { if (!start || !end) return 0; return Math.max(0, Math.min(100, ((Date.now() - Date.parse(start)) / (Date.parse(end) - Date.parse(start))) * 100)) }
async function loadDashboard() {
  try { const result = await communityService.dashboard(); if (!disposed) { dashboard.value = result; dashboardError.value = ''
    if (activityPage.value === 1) activity.value = result.activity.slice(0,5)
    activityPages.value = Math.max(1,Math.ceil((result.activityTotal ?? result.activity.length)/5)) } }
  catch (error) { if (!disposed) dashboardError.value = errorMessage(error) }
}
async function loadMap() {
  mapController?.abort()
  mapController = new AbortController()
  const controller = mapController
  mapLoading.value = true
  try {
    const result = await api.get<ApiResponse<MapPoint[]>>('/geography', {q:q.value,tag:selectedTags.value.join(',')}, controller.signal)
    if (!controller.signal.aborted && !disposed) { points.value = result.data; geographyError.value = '' }
  } catch (error) { if (!controller.signal.aborted && !disposed) geographyError.value = errorMessage(error) }
  finally { if (!controller.signal.aborted && !disposed) mapLoading.value = false }
}
async function loadActivity(more = false) {
  if (activityLoading.value) return
  activityLoading.value = true
  try {
    const page = more ? activityPage.value + 1 : 1
    const result = await api.get<ListResponse<Activity>>('/activity', {page,limit:5})
    if (disposed) return
    activity.value = more ? [...activity.value, ...result.data].filter((item,index,array)=>array.findIndex(a=>a.id===item.id)===index) : result.data
    activityPage.value = page; activityPages.value = result.meta.pages; activityError.value = ''
  } catch(error) { if (!disposed) activityError.value = errorMessage(error) }
  finally { if (!disposed) activityLoading.value = false }
}
watch([q,selectedTags], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    void router.replace({query: {...route.query, q:q.value || undefined,tag:selectedTags.value.join(',') || undefined}})
    void loadMap()
  },250)
}, {deep:true})
watch(() => [route.query.q, route.query.tag], () => {
  const nextQ = String(route.query.q || ''), nextTags = String(route.query.tag || '')
  if (q.value !== nextQ) q.value = nextQ
  if (selectedTags.value.join(',') !== nextTags) selectedTags.value = nextTags.split(',').filter(Boolean)
})
onMounted(() => {
  void loadDashboard(); void loadMap()
  unsubscribe = subscribeRealtime(message => {
    if (message.type === 'activity') { activity.value = [message.data,...activity.value.filter(a=>a.id !== message.data.id)]; activity.value = activity.value.slice(0,Math.max(5,activityPage.value * 5)) }
    else { if (message.resource === 'dashboard' || message.resource === '*') void loadDashboard(); if (message.resource === 'users' || message.resource === '*') void loadMap() }
  })
})
onBeforeUnmount(() => { disposed = true; unsubscribe?.(); clearTimeout(debounce); mapController?.abort() })
</script>

<template lang="pug">
.dashboard
  .dashboard-intro
    div
      .eyebrow ТВОЯ ТЕРРИТОРИЯ · ТВОИ ЛЮДИ
      h1 Сильнее, когда 
        span вместе.
      p.lead Находи своих. Принимай вызовы. Делай то, что имеет значение.
    .intro-actions
      RouterLink.button.ghost(v-if="auth.user" :to="userPath(auth.user)")
        Icon(name="user")
        span Мой профиль
      RouterLink.button.primary(to="/events")
        Icon(name="arrow-up-right-from-square")
        span Найти событие
  p.inline-error(v-if="dashboardError") {{ dashboardError }}
    button.button.small(@click="loadDashboard") Повторить
  .metric-grid
    .metric-card.panel(v-for="metric in metrics" :key="metric.label")
      .metric-icon
        Icon(:name="metric.icon")
      .metric-content
        strong.metric-number {{ metric.value }}
        span.metric-label {{ metric.label }}
        span.metric-sub {{ metric.sub }}
  .dashboard-grid
    .dashboard-primary
      section.panel.map-panel
        .panel-heading
          div
            h2 Наши люди. По всему миру.
            p Точка на карте — начало настоящего знакомства.
          span.map-badge НА СВЯЗИ
        .map-tools
          .map-search
            Icon(name="magnifying-glass")
            input(v-model="q" placeholder="Имя, город или интересы участника…" aria-label="Поиск участников на карте")
            button.icon-button(v-if="q" aria-label="Очистить поиск" @click="q = ''")
              Icon(name="xmark")
          CommunityTagFilter.map-tag-filter(v-model="selectedTags" :tags="rankedTags" :loading="tagsLoading" :error="tagsError" @retry="refreshTags")
        p.inline-error(v-if="geographyError") {{ geographyError }}
          button.button.small(@click="loadMap") Повторить
        ErrorBoundary
          WorldMap(:points="points" :loading="mapLoading")
        .map-footnote
          span
            i.legend-dot
            | {{ matchingCount }} участников · {{ points.length }} городов
          RouterLink.text-link(:to="{path:'/users',query:{q:q || undefined,tag:selectedTags.join(',') || undefined}}") К списку
            Icon(name="arrow-right")
      section.panel
        .panel-heading
          div
            h2 Вызов принят
            p Маленькие действия. Большие перемены.
          RouterLink.text-link(to="/challenges") Все челленджи
            Icon(name="arrow-right")
        p.empty-message(v-if="dashboard && !dashboard.challenges.length") В этом месяце пока нет челленджей.
        RouterLink.challenge-preview(v-for="challenge in dashboard?.challenges.slice(0,2)" :key="challenge.id" :to="'/challenges/' + (challenge.publicId ?? challenge.id)" style="display:block")
          .challenge-top
            div
              h3 {{ challenge.title }}
              .challenge-type
                Icon(name="fire")
                | {{ challenge.participantCount ?? challenge.participants.length }} участников · {{ challenge.goal?.target }} {{ challenge.goal?.unit }}
            Icon(name="arrow-up-right-from-square")
          .challenge-progress(role="progressbar" :aria-valuenow="Math.round(progress(challenge.schedule?.start,challenge.schedule?.end))" aria-valuemin="0" aria-valuemax="100" aria-label="Время челленджа")
            span(:style="{width: progress(challenge.schedule?.start,challenge.schedule?.end) + '%'}")
          .challenge-bottom
            span {{ date(challenge.schedule?.start) }} — {{ date(challenge.schedule?.end) }}
            span {{ challenge.goal?.unit || 'Действуй каждый день' }}
      section.panel
        .panel-heading
          div
            h2 Своя команда — твоя опора
            p Выбери людей, с которыми идёшь дальше.
          RouterLink.text-link(to="/teams") Все команды
            Icon(name="arrow-right")
        .team-mini-grid
          RouterLink.team-mini(v-for="(team,index) in dashboard?.teams.slice(0,4)" :key="team.id" :to="'/teams/' + (team.publicId ?? team.id)")
            .team-emblem
              Icon(:name="index % 2 ? 'fire' : 'mountain-sun'")
            div
              h3 {{ team.title }}
              p {{ team.participantCount ?? team.participants.length }} участников · Активна
            Icon(name="chevron-right")
    .dashboard-aside
      section.panel
        .panel-heading
          h2 Ближайшая встреча
          span.month-label {{ month.split(' ')[0] }}
        .event-preview(v-if="nextEvent")
          RouterLink.event-illustration(:to="'/events/' + (nextEvent.publicId ?? nextEvent.id)" tabindex="-1" aria-hidden="true")
            i.sun
            span {{ nextEvent.category === 'online' ? 'ОНЛАЙН' : 'ВЫХОД ИЗ ЗОНЫ КОМФОРТА' }}
          .event-meta
            span
              Icon(name="calendar-days")
              | {{ date(nextEvent.schedule?.start) }}
            span
              Icon(name="location-dot")
              | {{ nextEvent.location?.city || 'Онлайн' }}
          h3 {{ nextEvent.title }}
          .event-meta
            span
              Icon(name="users")
              | {{ nextEvent.participantCount ?? nextEvent.participants.length }} уже в деле
          RouterLink.button.primary(:to="'/events/' + (nextEvent.publicId ?? nextEvent.id)") Подробнее о встрече
            Icon(name="arrow-right")
        p.empty-message(v-else) Новые встречи появятся здесь.
      section.panel
        .panel-heading
          h2 Пульс сообщества
          span.map-badge LIVE
        p.inline-error(v-if="activityError") {{ activityError }}
          button.button.small(@click="loadActivity()") Повторить
        .activity-list(aria-label="Последние события" aria-live="polite")
          .activity-row(v-for="event in activity" :key="event.id")
            Avatar(:user="event.actor" size="sm")
            .activity-copy
              RouterLink(:to="userPath(event.actor)")
                strong {{ event.actor.name }}
              span.admin-label(v-if="event.actor.role === 'admin'") АДМИН
              |  {{ event.action }}
              RouterLink(v-if="event.target" :to="event.target.path")  {{ event.target.title }}
              time(:datetime="event.createdAt") {{ time(event.createdAt) }}
          p.empty-message(v-if="!activity.length && !activityLoading") Здесь появятся события сообщества.
        .activity-footer(v-if="activityPage < activityPages")
          button(:disabled="activityLoading" @click="loadActivity(true)") {{ activityLoading ? 'Загрузка…' : 'Показать ещё' }}
      .aside-note
        Icon(name="quote-left")
        p Характер проявляется в действиях.
        span Каждый день — возможность стать сильнее.
</template>

<style scoped>
.map-tag-filter{margin:.85rem 0 1rem}
.aside-note{padding:1.3rem .8rem;color:#7d886e}.aside-note>svg{color:#695238;font-size:1.3rem}.aside-note p{font-family:'Oswald',sans-serif;color:#b8bda9;font-size:1.25rem;margin:.6rem 0 .4rem}.aside-note span{font-size:.67rem;line-height:1.8}.challenge-preview>svg{font-size:.7rem}.inline-error .button{margin-left:.8rem}
</style>
