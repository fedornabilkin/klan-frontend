<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { NAlert, NButton, NSkeleton } from 'naive-ui'
import type { ApiResponse, Statistics } from '@shared/contracts'
import { api } from '@/services/api'
import { useRealtime } from '@/composables/useRealtime'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const stats = ref<Statistics | null>(null)
const loading = ref(true)
const error = ref('')
let controller: AbortController | undefined
let requestId = 0
const showSmallCities = ref(false)
const smallCities = computed(() => stats.value?.cities.filter(city => city.count < 2) ?? [])
const displayedCities = computed(() => showSmallCities.value ? stats.value?.cities : stats.value?.cities.filter(city => city.count >= 2))
const cityMaximum = computed(() => maximum(stats.value?.cities ?? []))
const totalActivity = computed(() => stats.value?.activity.reduce((sum, item) => sum + item.count, 0) ?? 0)
const maximum = (values: { count: number }[]) => Math.max(1, ...values.map(item => item.count))
const dateLabel = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
async function load() {
  controller?.abort()
  controller = new AbortController()
  const request = ++requestId
  loading.value = true; error.value = ''
  try {
    const result = await api.get<ApiResponse<Statistics>>('/stats', undefined, controller.signal)
    if (request === requestId) stats.value = result.data
  }
  catch (e) { if (request === requestId && !(e instanceof Error && e.name === 'AbortError')) error.value = e instanceof Error ? e.message : 'Не удалось загрузить статистику.' }
  finally { if (request === requestId) loading.value = false }
}
onMounted(load)
onScopeDispose(() => { ++requestId; controller?.abort() })
useRealtime(message => { if (message.type === 'invalidate' && ['stats','*'].includes(message.resource)) void load() })
</script>

<template lang="pug">
.stats-page
  PageHeader(title="Клан в цифрах" description="В каких городах мы живём и кто вышел в лидеры челленджей.")
    NButton(secondary :loading="loading" @click="load")
      template(#icon)
        Icon(name="refresh")
      | Обновить
  NAlert(v-if="error" type="error" :title="error")
    NButton(size="small" @click="load") Повторить
  template(v-else-if="loading")
    NSkeleton(height="8rem")
    NSkeleton(height="20rem")
  template(v-else-if="stats")
    .stats-kpis
      .stats-kpi
        Icon(name="users")
        strong {{ stats.users }}
        span участников
      .stats-kpi
        Icon(name="globe")
        strong {{ stats.cities.length }}
        span городов
      .stats-kpi
        Icon(name="flag")
        strong {{ stats.teams.length }}
        span команд
      .stats-kpi
        Icon(name="bolt")
        strong {{ totalActivity }}
        span событий за период
    .stats-grid
      section.stats-panel
        .stats-heading
          h2 География
          Icon(name="location-dot")
        .stats-bars(v-if="stats.cities.length")
          .stats-bar-row(v-for="city in displayedCities" :key="city.name")
            .stats-bar-label
              span {{ city.name || 'Не указан' }}
              b {{ city.count }}
            .stats-track
              .stats-fill(:style="{ width: `${city.count / cityMaximum * 100}%` }")
          button.small-cities(v-if="smallCities.length" type="button" :aria-expanded="showSmallCities" @click="showSmallCities = !showSmallCities")
            Icon(:name="showSmallCities ? 'chevron-up' : 'chevron-down'")
            | {{ showSmallCities ? 'Скрыть' : 'Показать' }} города с одним участником ({{ smallCities.length }})
        EmptyState(v-else title="Пока нет данных" description="Города появятся после заполнения профилей.")
      section.stats-panel
        .stats-heading
          h2 Общие интересы
          Icon(name="tags")
        .interest-cloud(v-if="stats.interests.length")
          .interest-tag(v-for="interest in stats.interests" :key="interest.name")
            span {{ interest.name }}
            b {{ interest.count }}
        EmptyState(v-else title="Расскажите о себе" description="Добавьте интересы в свой профиль.")
      section.stats-panel
        .stats-heading
          h2 Участие в командах
          Icon(name="flag")
        .team-stats(v-if="stats.teams.length")
          RouterLink.team-stat(v-for="team in stats.teams" :key="team.id" :to="`/teams/${team.publicId ?? team.id}`")
            span {{ team.title }}
            b {{ team.count }}
        EmptyState(v-else title="Команд пока нет")
      section.stats-panel
        .stats-heading
          h2 Челленджи и призовые места
          Icon(name="trophy")
        article.podium(v-for="challenge in stats.challenges" :key="challenge.id")
          RouterLink.podium-title(:to="`/challenges/${challenge.publicId ?? challenge.id}`") {{ challenge.title }}
          small {{ challenge.finished ? 'Итоги' : 'Текущие места' }}
          template(v-if="challenge.teams.length || challenge.people.length")
            template(v-if="challenge.teams.length")
              h3 Командный зачёт
              ol
                li(v-for="row in challenge.teams" :key="row.team.id")
                  RouterLink(:to="`/teams/${row.team.publicId ?? row.team.id}`") {{ row.team.title }}
                  b {{ row.score.toLocaleString('ru-RU') }} {{ challenge.unit }}
            template(v-if="challenge.people.length")
              h3 Личный зачёт
              ol
                li(v-for="row in challenge.people" :key="row.user.id")
                  UserAvatar(:user="row.user")
                  b {{ row.score.toLocaleString('ru-RU') }} {{ challenge.unit }}
          p(v-else) Подтверждённых результатов пока нет.
        EmptyState(v-if="!stats.challenges?.length" title="Челленджей пока нет")
      section.stats-panel.stats-wide
        .stats-heading
          div
            h2 Пульс сообщества
            p События пользователей по дням
          Icon(name="chart-line")
        .activity-chart(v-if="stats.activity.length" role="img" aria-label="Количество событий по дням")
          .activity-column(v-for="point in stats.activity" :key="point.date" tabindex="0" :data-tooltip="`${dateLabel(point.date)}: ${point.count}`")
            span.activity-value {{ point.count }}
            .activity-bar-space
              .activity-bar(:style="{ height: `${Math.max(point.count ? 3 : 0, point.count / maximum(stats.activity) * 100)}%` }")
            span.activity-date {{ dateLabel(point.date) }}
        EmptyState(v-else title="Активность ещё не накоплена")
</template>

<style scoped>
.stats-page { display: grid; gap: 1.5rem; }
.stats-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stats-kpi { display: grid; gap: .5rem; padding: 1.5rem; background: #1b1c1e; border: 1px solid #2b2c2e; border-radius: .75rem; }
.stats-kpi :deep(svg) { color: #ff7a00; }
.stats-kpi strong { font-size: 2.4rem; font-weight: 650; line-height: 1.2; }
.stats-kpi span { color: #929297; font-size: .8rem; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.stats-panel { padding: 1.5rem; background: #191a1c; border: 1px solid #2b2c2e; border-radius: .75rem; min-width: 0; }
.stats-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.stats-heading h2 { font-size: 1rem; margin: 0; }
.stats-heading p { font-size: .8rem; color: #929297; margin: .3rem 0 0; }
.stats-heading > :deep(svg) { color: #77797e; }
.stats-bars { display: grid; gap: 1rem; }
.stats-bar-label { display: flex; justify-content: space-between; font-size: .8rem; margin-bottom: .5rem; }
.stats-bar-label b { color: #aaa; }
.stats-track { background: #ffffff08; height: .4rem; border-radius: .4rem; }
.stats-fill { background: linear-gradient(90deg, #da5617, #ff8a36); height: 100%; border-radius: inherit; }
.interest-cloud { display: flex; flex-wrap: wrap; align-content: flex-start; gap: .65rem; }
.interest-tag { display: flex; gap: .8rem; padding: .65rem .85rem; border-radius: .35rem; background: #ff7a000b; border: 1px solid #ff7a0025; color: #ccc; font-size: .8rem; }
.interest-tag b { color: #ff8a36; }
.team-stats { display: grid; }
.team-stat { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: #ccc; text-decoration: none; padding: .85rem 0; font-size: .85rem; border-bottom: 1px solid #ffffff08; }
.team-stat b { color: #ff8a36; }
.small-cities{justify-self:start;background:none;color:var(--accent);border:0;padding:.5rem 0;font:inherit;font-size:.78rem;cursor:pointer}.small-cities svg{margin-right:.5rem}
.podium+.podium{margin-top:1.25rem;border-top:1px solid var(--border);padding-top:1rem}.podium-title{font-weight:700}.podium small,.podium p{display:block;color:var(--muted);font-size:.78rem}.podium h3{font-size:.78rem;margin:1rem 0 .4rem}.podium ol{padding-left:1.45rem;margin:0}.podium li{font-size:.82rem;padding:.4rem 0;overflow-wrap:anywhere}.podium li::marker{color:var(--accent);font-weight:700}.podium li b{display:inline-block;margin-left:.65rem;font-size:.72rem;color:var(--muted)}
.stats-wide { grid-column: 1 / -1; }
.activity-chart { display: flex; align-items: flex-end; gap: .5rem; min-height: 12rem; overflow-x: auto; }
.activity-column { display: flex; flex: 1; flex-direction: column; align-items: center; min-width: 2rem; gap: .5rem; }
.activity-value { color: #bbb; font-size: .65rem; }
.activity-bar-space { height: 8rem; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.activity-bar { width: 70%; background: linear-gradient(#ff8738, #9a3b17); border-radius: .2rem .2rem 0 0; }
.activity-date { color: #77797e; font-size: .6rem; white-space: nowrap; }
@media(max-width: 48rem) { .stats-grid { grid-template-columns: 1fr; } .stats-kpis { grid-template-columns: 1fr 1fr; } .stats-kpi { padding: 1rem; } }
</style>
