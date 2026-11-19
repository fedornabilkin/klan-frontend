<script setup lang="ts">
import { NAlert, NButton, NModal, NSkeleton } from 'naive-ui';
import { userPath } from '@shared/user-links';
import type { MemberAnalytics } from '@shared/analytics';
import Avatar from '@/components/ui/Avatar.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AnalyticsBars from './AnalyticsBars.vue';
defineProps<{ show: boolean; value: MemberAnalytics | null; loading: boolean; error: string }>();
const emit = defineEmits<{ close: []; refresh: []; page: [page: number] }>();
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) : 'Не зафиксировано';
const dateDay = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : '—';
const kinds: Record<string, string> = { events: 'Мероприятие', challenges: 'Челлендж', teams: 'Команда', books: 'Книга' };
const safeTarget = (path?: string) => path?.startsWith('/') && !path.startsWith('//') ? path : undefined;
</script>

<template lang="pug">
NModal(:show="show" preset="card" title="Аналитика участника" class="feature-modal" :style="{width:'58rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="value => { if (!value) emit('close') }")
  .member-analytics
    NAlert(v-if="error" type="error" :title="error")
      NButton(size="small" @click="emit('refresh')") Повторить
    template(v-else-if="loading")
      NSkeleton(height="6rem")
      NSkeleton(height="16rem")
    template(v-else-if="value")
      .member-heading
        Avatar(:user="value.member.user" size="lg")
        div
          h2 {{ value.member.user.name }}
          p {{ [value.member.user.location.city, value.member.user.location.country].filter(Boolean).join(', ') || 'Место не указано' }}
          RouterLink(:to="userPath(value.member.user)") Открыть профиль
      p.analytics-note Период: {{ value.range.from }} — {{ value.range.to }} включительно, UTC. Последнее записанное действие за всё доступное время: {{ dateTime(value.member.lastRecordedActivity) }}{{ value.member.lastRecordedActivity ? ' UTC' : '' }}.
      .member-metrics
        div
          strong {{ value.member.period.actions }}
          span действий за период
        div
          strong {{ value.member.period.activeDays }}
          span активных дней
        div
          strong {{ value.member.period.resultEntries }}
          span записей результатов
        div
          strong {{ value.member.profileCompleteness }}%
          span заполнение профиля
      section
        h3 Профиль на сейчас
        .profile-checks
          span(v-for="field in value.profileFields" :key="field.label" :class="{'is-filled':field.filled}") {{ field.filled ? '✓' : '—' }} {{ field.label }}
        p.analytics-note Достижений: {{ value.member.current.achievements }}. Отметок о прочтении книг: {{ value.member.current.books }}.
      section
        h3 Сохранённое участие и прочитанные книги
        p.analytics-note Текущие записи в данных, включая архивные команды и события. Запись на мероприятие не подтверждает фактическое посещение.
        .participation-list(v-if="value.participation.length")
          .participation-row(v-for="item in value.participation" :key="`${item.type}:${item.id}`")
            div
              small {{ kinds[item.type] || item.type }}
              RouterLink(:to="`/${item.type}/${item.publicId ?? item.id}`") {{ item.title }}
              small(v-if="item.start") {{ dateDay(item.start) }} — {{ dateDay(item.end) }} UTC
            StatusBadge(:status="item.status")
        EmptyState(v-else title="Записей об участии пока нет")
      section
        h3 Результаты по челленджам
        p.analytics-note Значения складываются только внутри одного челленджа. «За период» относится к дате результата.
        .table-scroll(v-if="value.challenges.length")
          table
            caption.sr-only Результаты участника по челленджам
            thead
              tr
                th(scope="col") Челлендж
                th(scope="col") За период
                th(scope="col") Всего в данных
                th(scope="col") Записей за период
            tbody
              tr(v-for="challenge in value.challenges" :key="challenge.id")
                th(scope="row")
                  RouterLink(:to="`/challenges/${challenge.publicId ?? challenge.id}`") {{ challenge.title }}
                td {{ challenge.periodValue.toLocaleString('ru-RU') }} {{ challenge.unit }}
                td {{ challenge.totalValue.toLocaleString('ru-RU') }} {{ challenge.unit }}
                td {{ challenge.periodEntries }}
        EmptyState(v-else title="Результатов пока нет")
      section
        h3 Действия за выбранный период
        AnalyticsBars(:values="value.actions" empty="За период нет зарегистрированных действий")
      section
        .journal-heading
          h3 Журнал действий
          span {{ value.activity.meta.total }} записей
        ol.activity-list(v-if="value.activity.data.length")
          li(v-for="activity in value.activity.data" :key="activity.id")
            time(:datetime="activity.createdAt") {{ dateTime(activity.createdAt) }} UTC
            p
              span {{ activity.action }}
              RouterLink(v-if="safeTarget(activity.target?.path)" :to="safeTarget(activity.target?.path) || '/admin/analytics'") {{ activity.target?.title }}
              span(v-else-if="activity.target") {{ activity.target.title }}
        EmptyState(v-else title="Журнал за этот период пуст")
        Pagination(:page="value.activity.meta.page" :pages="value.activity.meta.pages" @change="emit('page',$event)")
</template>

<style scoped>
.member-analytics{display:grid;gap:1.5rem;min-width:0}.member-heading{display:flex;align-items:center;gap:1rem}.member-heading h2{margin:0;font-size:1.3rem;overflow-wrap:anywhere}.member-heading p{margin:.4rem 0;color:#a1a798;font-size:.8rem}a{color:#eda16a;text-decoration:none}a:hover{text-decoration:underline}.analytics-note{font-size:.75rem;line-height:1.7;color:#949b8e;margin:0}.member-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}.member-metrics>div{padding:1rem;border:1px solid #ffffff12;border-radius:.6rem;display:grid;gap:.5rem}.member-metrics strong{font-size:1.55rem;color:#f3a46a}.member-metrics span{font-size:.72rem;color:#a1a798}h3{margin:0 0 .8rem;font-size:1rem}.profile-checks{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.7rem}.profile-checks span{padding:.45rem .65rem;background:#ffffff05;border:1px solid #ffffff0c;border-radius:.4rem;font-size:.74rem;color:#92968c}.profile-checks .is-filled{color:#aeca99;border-color:#aeca9930}.participation-list{margin-top:.8rem}.participation-row{display:flex;gap:.8rem;align-items:center;justify-content:space-between;padding:.8rem 0;border-bottom:1px solid #ffffff0c}.participation-row>div{display:grid;gap:.3rem;min-width:0}.participation-row a{overflow-wrap:anywhere;font-size:.85rem}.participation-row small{color:#858e7b;font-size:.68rem}.table-scroll{max-width:100%;overflow:auto;margin-top:.8rem}table{border-collapse:collapse;width:100%;font-size:.78rem;text-align:left;min-width:32rem}th,td{padding:.8rem;border-bottom:1px solid #ffffff0c}thead th{color:#929b88;font-size:.7rem;font-weight:500}tbody th{font-weight:500}.journal-heading{display:flex;justify-content:space-between;gap:.8rem;align-items:baseline}.journal-heading>span{font-size:.7rem;color:#8e9784}.activity-list{padding:0;list-style:none;margin:0;display:grid;gap:.7rem}.activity-list li{padding:.75rem;border-left:2px solid #d97e3d;background:#ffffff03}.activity-list time{font-size:.66rem;color:#8e9784}.activity-list p{display:flex;flex-wrap:wrap;gap:.4rem;margin:.35rem 0 0;font-size:.78rem;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(min-width:42rem){.member-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}
.member-analytics{grid-template-columns:minmax(0,1fr)}
.member-analytics>*,.member-analytics section,.member-metrics>div{min-width:0}
.member-heading{flex-wrap:wrap}
.member-heading>div{min-width:0;flex:1 1 10rem}
.analytics-note,.member-metrics strong,.profile-checks span{overflow-wrap:anywhere}
.table-scroll{width:100%;min-width:0}
.activity-list{grid-template-columns:minmax(0,1fr)}
.journal-heading{flex-wrap:wrap}
</style>
