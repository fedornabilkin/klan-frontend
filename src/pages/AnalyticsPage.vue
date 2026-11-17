<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NButton, NInput, NSelect, NSkeleton } from 'naive-ui';
import { useAnalytics } from '@/composables/useAnalytics';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Avatar from '@/components/ui/Avatar.vue';
import Icon from '@/components/ui/Icon.vue';
import AnalyticsBars from '@/components/features/AnalyticsBars.vue';
import AnalyticsMemberModal from '@/components/features/AnalyticsMemberModal.vue';

const analytics = useAnalytics();
const { range, rangeDraft, rangeError, today, search, sort, activity, page, selected } = analytics;
const { data: community, loading: communityLoading, error: communityError } = analytics.community;
const { data: members, loading: membersLoading, error: membersError } = analytics.members;
const { data: detail, loading: detailLoading, error: detailError } = analytics.detail;
const maximumDay = computed(() => Math.max(1, ...community.value?.daily.map(day => day.actions) ?? []));
const dayLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Нет записей';
const dateDay = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : '—';
const sortOptions = [
  { label: 'Больше действий за период', value: '-actions' }, { label: 'Последнее записанное действие', value: '-lastActivity' },
  { label: 'Заполнение профиля', value: '-completeness' }, { label: 'По имени', value: 'name' }, { label: 'Новые участники', value: '-joinedAt' },
];
const activityOptions = [
  { label: 'Все участники', value: 'all' }, { label: 'С действиями за период', value: 'active' }, { label: 'Без действий за период', value: 'inactive' },
];
</script>

<template lang="pug">
.analytics-page
  PageHeader(title="Аналитика сообщества" eyebrow="ДАННЫЕ ДЛЯ АДМИНИСТРАТОРА" description="Активность за выбранный период, текущий состав и подробные данные по каждому участнику.")
    NButton(secondary :loading="communityLoading || membersLoading" @click="analytics.refresh")
      template(#icon)
        Icon(name="refresh")
      | Обновить
  form.analytics-range(@submit.prevent="analytics.applyRange")
    label
      span Начало периода
      input(v-model="rangeDraft.from" type="date" required :max="today" aria-label="Начало периода аналитики")
    label
      span Окончание периода
      input(v-model="rangeDraft.to" type="date" required :max="today" aria-label="Окончание периода аналитики")
    NButton(type="primary" attr-type="submit") Применить
    .range-shortcuts
      NButton(size="small" secondary @click="analytics.quickRange(7)") 7 дней
      NButton(size="small" secondary @click="analytics.quickRange(30)") 30 дней
      NButton(size="small" secondary @click="analytics.quickRange(90)") 90 дней
  NAlert(v-if="rangeError" type="warning" :title="rangeError")
  p.analytics-note Даты включены целиком, часовой пояс UTC. Период не более 366 дней. Посещения страниц не отслеживаются: активность здесь — зарегистрированные действия в сервисе.
  section.community-section(aria-labelledby="community-heading")
    .section-heading
      div
        h2#community-heading Сообщество
        p {{ range.from }} — {{ range.to }}
    NAlert(v-if="communityError" type="error" :title="communityError")
      NButton(size="small" @click="analytics.loadCommunity") Повторить
    template(v-else-if="communityLoading")
      NSkeleton(height="8rem")
      NSkeleton(height="16rem" style="margin-top:1rem")
    template(v-else-if="community")
      .analytics-kpis
        .analytics-kpi
          strong {{ community.period.activeMembers }}
          span участников с действиями
          small {{ community.period.activeMemberPercent }}% текущего состава
        .analytics-kpi
          strong {{ community.period.actions.toLocaleString('ru-RU') }}
          span действий за период
          small {{ community.period.inactiveMembers }} участников без действий
        .analytics-kpi
          strong {{ community.period.newMembers }}
          span новых участников
          small по дате присоединения
        .analytics-kpi
          strong {{ community.period.resultEntries }}
          span записей результатов
          small от {{ community.period.resultContributors }} участников
      .snapshot-panel
        h3 Текущее состояние
        p.analytics-note Эти показатели относятся к сохранённым данным на сейчас и не ограничены выбранными датами.
        dl.snapshot-metrics
          div
            dt Участники
            dd {{ community.current.members }}
          div
            dt Города / страны
            dd {{ community.current.cities }} / {{ community.current.countries }}
          div
            dt Активные команды
            dd {{ community.current.activeTeams }}
          div
            dt Записи на мероприятия
            dd {{ community.current.eventRegistrations }}
          div
            dt Записи в челленджи
            dd {{ community.current.challengeRegistrations }}
          div
            dt Отметки «прочитано»
            dd {{ community.current.bookReadMarks }}
          div
            dt Среднее заполнение профиля
            dd {{ community.current.averageProfileCompleteness }}%
      .analytics-grid
        section.analytics-panel.analytics-wide
          .section-heading
            div
              h3 Динамика действий
              p По дням выбранного периода
          .daily-chart(v-if="community.daily.some(day => day.actions > 0)" role="img" aria-label="Зарегистрированные действия по дням; значения и даты подписаны на столбцах")
            .daily-column(v-for="day in community.daily" :key="day.date" :title="`${day.date}: ${day.actions} действий, ${day.activeMembers} участников с действиями, ${day.newMembers} новых участников`")
              span {{ day.actions }}
              .daily-space
                i(:style="{height:`${day.actions / maximumDay * 100}%`}")
              time(:datetime="day.date") {{ dayLabel(day.date) }}
          EmptyState(v-else title="За период нет действий" description="Попробуйте выбрать более широкий период.")
          details.daily-details
            summary Данные по дням: действия, участники и новые регистрации
            .table-scroll
              table
                caption.sr-only Ежедневные показатели сообщества в UTC
                thead
                  tr
                    th(scope="col") Дата (UTC)
                    th(scope="col") Действий
                    th(scope="col") Участников с действиями
                    th(scope="col") Новых участников
                tbody
                  tr(v-for="day in community.daily" :key="day.date")
                    th(scope="row") {{ day.date }}
                    td {{ day.actions }}
                    td {{ day.activeMembers }}
                    td {{ day.newMembers }}
        section.analytics-panel
          h3 Типы действий за период
          AnalyticsBars(:values="community.actions" empty="Действий за период нет")
        section.analytics-panel
          h3 География на сейчас
          AnalyticsBars(:values="community.geography" empty="Участники ещё не указали географию")
        section.analytics-panel
          h3 Интересы на сейчас
          AnalyticsBars(:values="community.interests" empty="Участники ещё не добавили интересы")
        section.analytics-panel
          h3 Команды на сейчас
          .participation-list(v-if="community.teams.length")
            .participation-row(v-for="team in community.teams" :key="team.id")
              RouterLink(:to="`/teams/${team.id}`") {{ team.title }}
              span {{ team.participants }} · {{ team.status === 'active' ? 'активна' : 'архив' }}
          EmptyState(v-else title="Команд пока нет")
        section.analytics-panel.analytics-wide
          h3 Записи на мероприятия
          p.analytics-note Текущее количество записанных участников. Регистрация не подтверждает посещение; отменённые записи в этот показатель не входят.
          .table-scroll(v-if="community.events.length")
            table
              caption.sr-only Сохранённые регистрации на мероприятия
              thead
                tr
                  th(scope="col") Мероприятие
                  th(scope="col") Начало (UTC)
                  th(scope="col") Записались
              tbody
                tr(v-for="event in community.events" :key="event.id")
                  th(scope="row")
                    RouterLink(:to="`/events/${event.id}`") {{ event.title }}
                  td {{ dateDay(event.start) }}
                  td {{ event.participants }}
          EmptyState(v-else title="Мероприятий пока нет")
        section.analytics-panel.analytics-wide
          h3 Челленджи: результаты за период
          p.analytics-note Период определяется датой результата. Значения разных челленджей и единиц измерения не суммируются.
          .table-scroll(v-if="community.challenges.length")
            table
              caption.sr-only Результаты по каждому челленджу за период
              thead
                tr
                  th(scope="col") Челлендж
                  th(scope="col") Записались всего
                  th(scope="col") Внесли результаты за период
                  th(scope="col") Результат за период
                  th(scope="col") Всего в данных
              tbody
                tr(v-for="challenge in community.challenges" :key="challenge.id")
                  th(scope="row")
                    RouterLink(:to="`/challenges/${challenge.id}`") {{ challenge.title }}
                  td {{ challenge.participants }}
                  td {{ challenge.periodContributors }}
                  td {{ challenge.periodValue.toLocaleString('ru-RU') }} {{ challenge.unit }}
                  td {{ challenge.totalValue.toLocaleString('ru-RU') }} {{ challenge.unit }}
          EmptyState(v-else title="Челленджей пока нет")
      p.analytics-note Доступный журнал: {{ community.coverage.storedActions }} действий. Время записей — UTC. Первое: {{ dateTime(community.coverage.firstRecordedActivity) }}; последнее: {{ dateTime(community.coverage.lastRecordedActivity) }}. Пустые даты не доказывают отсутствие активности вне сервиса.
  section.members-section(aria-labelledby="members-heading")
    .section-heading
      div
        h2#members-heading Участники подробно
        p Действия учитываются за период, участие и профиль — по текущим данным.
    .members-toolbar
      NInput(v-model:value="search" placeholder="Имя, город или страна…" clearable aria-label="Поиск участников в аналитике")
        template(#prefix)
          Icon(name="search")
      NSelect(:value="activity" :options="activityOptions" aria-label="Фильтр активности участников" @update:value="analytics.setActivity")
      NSelect(:value="sort" :options="sortOptions" aria-label="Сортировка аналитики участников" @update:value="analytics.setSort")
    NAlert(v-if="membersError" type="error" :title="membersError")
      NButton(size="small" @click="analytics.loadMembers") Повторить
    template(v-else-if="membersLoading")
      NSkeleton(v-for="index in 3" :key="index" height="6rem" style="margin-top:.7rem")
    template(v-else-if="members")
      p.members-count Найдено: {{ members.meta.total }}
      .member-cards(v-if="members.data.length")
        article.member-card(v-for="member in members.data" :key="member.user.id")
          .member-name
            Avatar(:user="member.user")
            div
              button.member-open(type="button" @click="analytics.openMember(member.user.id)") {{ member.user.name }}
              p {{ [member.user.location.city,member.user.location.country].filter(Boolean).join(', ') || 'География не указана' }}
          dl.member-numbers
            div
              dt Действий / дней за период
              dd {{ member.period.actions }} / {{ member.period.activeDays }}
            div
              dt Мероприятий / челленджей
              dd {{ member.current.events }} / {{ member.current.challenges }}
            div
              dt Прочитано / достижений
              dd {{ member.current.books }} / {{ member.current.achievements }}
            div
              dt Профиль заполнен
              dd {{ member.profileCompleteness }}%
          .member-bottom
            p Последнее действие: {{ dateTime(member.lastRecordedActivity) }}{{ member.lastRecordedActivity ? ' UTC' : '' }}
            NButton(size="small" secondary :aria-label="`Аналитика: ${member.user.name}`" @click="analytics.openMember(member.user.id)") Подробнее
      EmptyState(v-else title="Участники не найдены" description="Измените поиск или фильтр активности.")
      Pagination(:page="page" :pages="members.meta.pages" @change="analytics.setPage")
  AnalyticsMemberModal(:show="Boolean(selected)" :value="detail" :loading="detailLoading" :error="detailError" @close="analytics.closeMember" @refresh="analytics.loadDetail" @page="analytics.setActivityPage")
</template>

<style scoped>
.analytics-page{display:grid;gap:1.3rem;min-width:0}.analytics-page :deep(.page-header){margin-bottom:.2rem}.analytics-range{display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end}.analytics-range label{display:grid;gap:.4rem;flex:1;min-width:8rem}.analytics-range label>span{font-size:.7rem;color:#9aa28f}.analytics-range input{font:inherit;font-size:.82rem;color:#e5e9df;color-scheme:dark;background:#191d18;border:1px solid #ffffff1b;border-radius:.5rem;padding:.7rem;width:100%;min-height:2.5rem}.analytics-range input:focus{outline:2px solid #d6813e;outline-offset:1px}.range-shortcuts{display:flex;gap:.4rem;flex-wrap:wrap}.analytics-note{font-size:.73rem;line-height:1.75;color:#909986;margin:0}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem}.section-heading h2{margin:0;font-size:1.3rem}.section-heading p{color:#929b89;font-size:.75rem;margin:.45rem 0 0}.section-heading h3{margin:0}.community-section,.members-section{min-width:0}h3{margin:0 0 1rem;font-size:.97rem}a{color:#dba06f;text-decoration:none}a:hover{text-decoration:underline}.analytics-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.analytics-kpi{padding:1rem;border:1px solid #ffffff12;border-radius:.75rem;background:#1a1e19;display:grid;gap:.5rem;align-content:start}.analytics-kpi strong{font-size:1.85rem;color:#f09a58;line-height:1.2}.analytics-kpi span{font-size:.76rem}.analytics-kpi small{font-size:.65rem;color:#929b88;line-height:1.5}.snapshot-panel{padding:1.2rem;border:1px solid #ffffff0c;border-radius:.7rem;margin:1rem 0;background:#151915}.snapshot-panel h3{margin-bottom:.5rem}.snapshot-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1.2rem 0 0}.snapshot-metrics div{display:grid;gap:.4rem}.snapshot-metrics dt{font-size:.67rem;color:#929b88}.snapshot-metrics dd{margin:0;font-size:1.1rem;font-weight:700}.analytics-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;margin:1rem 0}.analytics-panel{border:1px solid #ffffff11;background:#191d18;border-radius:.7rem;padding:1.1rem;min-width:0}.daily-chart{display:flex;overflow-x:auto;gap:.65rem;padding:.5rem 0;min-height:11rem}.daily-column{flex:1 0 2.2rem;display:flex;flex-direction:column;align-items:center;gap:.5rem}.daily-column>span{font-size:.65rem;color:#a7af9e}.daily-space{height:7rem;width:100%;display:flex;align-items:flex-end;justify-content:center}.daily-space i{display:block;width:65%;min-height:1px;border-radius:.2rem .2rem 0 0;background:linear-gradient(#f99a4d,#8e401e)}.daily-column time{font-size:.6rem;white-space:nowrap;color:#89947d}.participation-row{display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid #ffffff0b;padding:.75rem 0;font-size:.8rem}.participation-row a{overflow-wrap:anywhere}.participation-row span{font-size:.7rem;white-space:nowrap;color:#95a184}.table-scroll{overflow:auto;margin-top:.7rem;max-width:100%}table{border-collapse:collapse;width:100%;font-size:.78rem;text-align:left;min-width:30rem}th,td{padding:.8rem;border-bottom:1px solid #ffffff0c}thead th{font-size:.66rem;font-weight:500;color:#909b83}tbody th{font-weight:500}.members-toolbar{display:grid;grid-template-columns:minmax(0,1fr);gap:.6rem}.members-count{font-size:.75rem;color:#98a28c}.member-cards{display:grid;gap:.8rem}.member-card{padding:1rem;border:1px solid #ffffff12;border-radius:.7rem;background:#191d18;min-width:0}.member-name{display:flex;align-items:center;gap:.8rem}.member-name>div{min-width:0}.member-open{padding:0;border:0;background:none;color:#e5e8df;cursor:pointer;font:inherit;font-size:.9rem;font-weight:700;text-align:left;overflow-wrap:anywhere}.member-open:hover{color:#efa069}.member-open:focus-visible{outline:2px solid #efa069;outline-offset:4px}.member-name p{font-size:.68rem;color:#919b83;margin:.4rem 0 0}.member-numbers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin:1rem 0}.member-numbers dt{font-size:.65rem;color:#929b88;line-height:1.5}.member-numbers dd{font-size:.9rem;margin:.2rem 0 0;font-weight:700;color:#d7b28f}.member-bottom{display:flex;justify-content:space-between;gap:.75rem;align-items:center;padding-top:.7rem;border-top:1px solid #ffffff09}.member-bottom p{font-size:.65rem;color:#929b88;margin:0;line-height:1.6}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(min-width:48rem){.analytics-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.analytics-range label{flex:0 1 11rem}.analytics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-wide{grid-column:1/-1}.snapshot-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.members-toolbar{grid-template-columns:minmax(12rem,1fr) 13rem 16rem}.member-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.daily-details{margin-top:1rem}.daily-details summary{cursor:pointer;color:#a7b09b;font-size:.73rem;line-height:1.6}.daily-details summary:focus-visible{outline:2px solid #efa069;outline-offset:4px}
</style>
