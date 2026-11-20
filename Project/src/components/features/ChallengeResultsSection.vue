<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { Entity } from '@shared/contracts';
import { challengeCalendar, paginateChallengeResults } from '@/domain/challengeResults';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ entity: Entity }>();
const sectionId = useId();
function localDay(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
const today = ref(localDay(new Date()));
const calendar = computed(() => challengeCalendar(props.entity, today.value));
const page = ref(1), pendingPage = ref(1);
const perPage = 25;
const pages = computed(() => Math.max(1, Math.ceil(calendar.value.rows.length / perPage)));
const visible = computed(() => calendar.value.rows.slice((page.value - 1) * perPage, page.value * perPage));
const unit = computed(() => props.entity.goal?.unit || 'ед.');
const pending = computed(() => [...props.entity.pendingResults ?? []].sort((a,b) =>
  a.user.name.localeCompare(b.user.name, 'ru') || a.user.id.localeCompare(b.user.id) || a.sourceCell.localeCompare(b.sourceCell, 'ru', { numeric:true })));
const pendingSelected = computed(() => paginateChallengeResults(pending.value, pendingPage.value));
const viewport = ref<HTMLElement>();
const todayIndex = computed(() => calendar.value.days.indexOf(today.value));
const geometry = computed(() => ({
  '--days': calendar.value.days.length,
  '--before': todayIndex.value,
  '--after': calendar.value.days.length - todayIndex.value - 1,
}));
const format = new Intl.NumberFormat('ru-RU');
const personHeader = ref<HTMLTableCellElement>();
let observer: ResizeObserver | undefined;
let frame = 0;
let midnight: ReturnType<typeof setTimeout>;

function centerDay() {
  const box = viewport.value;
  if (!box) return;
  const day = box.querySelector<HTMLElement>('[aria-current="date"]');
  if (!day) { box.scrollLeft = 0; return; }
  const pinned = personHeader.value?.getBoundingClientRect().width ?? 0;
  const cell = day.getBoundingClientRect();
  box.scrollLeft += cell.left + cell.width / 2 - box.getBoundingClientRect().left - box.clientLeft - (box.clientWidth + pinned) / 2;
}
function refreshDate() {
  clearTimeout(midnight);
  const now = new Date();
  today.value = localDay(now);
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  midnight = setTimeout(refreshDate, next.getTime() - now.getTime());
}
watch(pages, value => { page.value = Math.min(page.value, value); });
watch(() => pendingSelected.value.page, value => { pendingPage.value = value; });
watch(() => props.entity.id, () => { page.value = pendingPage.value = 1; });
watch([() => props.entity.id, todayIndex, () => calendar.value.days.length], centerDay, { flush: 'post' });
onMounted(() => {
  refreshDate();
  let width = -1, pinnedWidth = -1;
  observer = new ResizeObserver(() => {
    const nextWidth = viewport.value?.clientWidth ?? 0;
    const nextPinnedWidth = personHeader.value?.getBoundingClientRect().width ?? 0;
    if (width === nextWidth && pinnedWidth === nextPinnedWidth) return;
    width = nextWidth;
    pinnedWidth = nextPinnedWidth;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(centerDay);
  });
  if (viewport.value) observer.observe(viewport.value);
  if (personHeader.value) observer.observe(personHeader.value);
  centerDay();
});
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame); clearTimeout(midnight); });
</script>

<template>
  <section class="daily-results" :aria-labelledby="sectionId">
    <h2 :id="sectionId"><Icon name="calendar-days" />Результаты по дням</h2>
    <div v-if="pending.length" class="pending-notice" role="note">
      <strong>Есть результаты с неуточнённой датой</strong>
      <p>Записей: {{ pending.length.toLocaleString('ru-RU') }}. Их сумма — {{ pendingSelected.value.toLocaleString('ru-RU') }} {{ unit }} — пока не включена в общий результат и рейтинги.</p>
    </div>
    <div class="daily-summary">
      <span>Записей: <strong>{{ format.format(calendar.count) }}</strong></span>
      <span>Сумма: <strong>{{ format.format(calendar.total) }}</strong> {{ unit }}</span>
    </div>
    <div ref="viewport" class="daily-table-wrap calendar" role="region" aria-label="Результаты участников по дням" tabindex="0" :style="geometry">
      <table :class="{ 'has-today': todayIndex >= 0 }">
        <colgroup><col class="person-col" /></colgroup>
        <colgroup v-if="todayIndex >= 0"><col class="leading" /></colgroup>
        <colgroup v-for="month in calendar.months" :key="month.key" :span="month.count" class="day-cols" />
        <colgroup v-if="todayIndex >= 0"><col class="trailing" /></colgroup>
        <thead>
          <tr>
            <th ref="personHeader" rowspan="2" scope="col" class="person">Участник</th>
            <td v-if="todayIndex >= 0" class="spacer" rowspan="2" aria-hidden="true" />
            <th v-for="month in calendar.months" :key="month.key" scope="colgroup" :colspan="month.count" class="month"><span>{{ month.label }}</span></th>
            <td v-if="todayIndex >= 0" class="spacer" rowspan="2" aria-hidden="true" />
          </tr>
          <tr>
            <th v-for="day in calendar.days" :key="day" scope="col" :aria-current="day === today ? 'date' : undefined" :class="{ current: day === today }">
              <time :datetime="day">{{ Number(day.slice(-2)) }}</time>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.user.id">
            <th scope="row" class="person"><UserAvatar :user="row.user" /></th>
            <td v-if="todayIndex >= 0" class="spacer" aria-hidden="true" />
            <td v-for="day in calendar.days" :key="day" :class="{ current: day === today, missing: !row.values.has(day) }">
              {{ row.values.has(day) ? format.format(row.values.get(day)!) : '—' }}
            </td>
            <td v-if="todayIndex >= 0" class="spacer" aria-hidden="true" />
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!calendar.count" class="daily-empty">Результаты пока не добавлены.</p>
    <div v-if="pages > 1" class="daily-pagination">
      <span>Участники {{ (page - 1) * perPage + 1 }}–{{ Math.min(page * perPage, calendar.rows.length) }} из {{ calendar.rows.length }}</span>
      <Pagination v-model:page="page" :pages="pages" />
    </div>
    <details v-if="pending.length" class="pending-results">
      <summary>Требуют уточнения даты</summary>
      <p class="pending-hint">Ячейка указывает место записи в исходном файле.</p>
      <div class="daily-summary" role="status" aria-live="polite">
        <span>Записей: <strong>{{ pendingSelected.total.toLocaleString('ru-RU') }}</strong></span>
        <span>Сумма без даты: <strong>{{ pendingSelected.value.toLocaleString('ru-RU') }}</strong> {{ unit }}</span>
      </div>
      <div v-if="pendingSelected.rows.length" class="daily-table-wrap" role="region" aria-label="Результаты с неуточнённой датой" tabindex="0">
        <table>
          <thead><tr><th scope="col">Ячейка и причина</th><th scope="col">Участник</th><th scope="col">Команда</th><th scope="col" class="daily-value">{{ unit }}</th></tr></thead>
          <tbody>
            <tr v-for="(result, index) in pendingSelected.rows" :key="`${result.user.id}:${result.sourceCell}:${pendingSelected.first + index}`">
              <td class="pending-source"><strong>{{ result.sourceCell }}</strong><small>{{ result.reason }}</small></td>
              <td><UserAvatar :user="result.user" /></td>
              <td><RouterLink v-if="result.team" :to="`/teams/${encodeURIComponent(result.team.publicId ?? result.team.id)}`">{{ result.team.title }}</RouterLink><span v-else>Соло</span></td>
              <td class="daily-value">{{ result.value.toLocaleString('ru-RU') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="pendingSelected.total" class="daily-pagination">
        <span>Показаны {{ pendingSelected.first }}–{{ pendingSelected.last }} из {{ pendingSelected.total.toLocaleString('ru-RU') }}</span>
        <Pagination v-model:page="pendingPage" :pages="pendingSelected.pages" />
      </div>
    </details>
  </section>
</template>

<style scoped>
.daily-results{min-width:0;border:1px solid #302d29;border-radius:.9rem;padding:clamp(.8rem,2vw,1.5rem);background:#1a1919}
.daily-results h2{display:flex;align-items:center;gap:.6rem;margin:0 0 1rem;font-size:1rem;font-weight:650}.daily-results h2 :deep(svg){color:#d88d52}
.daily-summary,.daily-pagination{display:flex;align-items:center;gap:.5rem 1.2rem;flex-wrap:wrap;color:#b9ada0;font-size:.76rem;margin:.75rem 0}
.daily-summary strong{color:#e8c3a3}.daily-pagination{justify-content:center;margin-top:1rem}.daily-pagination :deep(.pagination){margin:0}
.daily-table-wrap{overflow-x:auto;max-width:100%;border:1px solid #3a3028;border-radius:.5rem;scrollbar-color:#655447 #24201d}
.daily-table-wrap:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.daily-table-wrap table{width:100%;border-spacing:0;text-align:left;font-size:.78rem;font-variant-numeric:tabular-nums}
.daily-table-wrap th,.daily-table-wrap td{padding:.45rem .55rem;border-bottom:1px solid #37312d}.daily-table-wrap th{background:#25211e;color:#c0afa0}
.calendar{container-type:inline-size;overflow-anchor:none;--person:clamp(7.5rem,32cqi,13rem);--day:3.4rem}
.calendar table{--leading:0px;--trailing:0px;table-layout:fixed;width:calc(var(--person) + var(--days) * var(--day) + var(--leading) + var(--trailing))}
.calendar table.has-today{--half:calc((100cqi - var(--person) - var(--day)) / 2);--leading:max(0px,calc(var(--half) - var(--before) * var(--day)));--trailing:max(0px,calc(var(--half) - var(--after) * var(--day)))}
.person-col{width:var(--person)}.day-cols{width:var(--day)}.leading{width:var(--leading)}.trailing{width:var(--trailing)}
.calendar th,.calendar td{text-align:center;border-right:1px solid #34302c;white-space:nowrap}.calendar .spacer{padding:0;border:0}
.calendar .person{position:sticky;left:0;z-index:1;background:#211f1d;text-align:left;white-space:normal;box-shadow:1px 0 #584d42}
.calendar tbody .person{padding:.52rem .6rem;font-weight:500}.calendar thead .person{z-index:2}
.calendar .month{text-align:left;font-weight:600}.month span{position:sticky;left:calc(var(--person) + .55rem);text-transform:capitalize}
.calendar .current{background:#362a20;color:#ffc495}.calendar thead .current{box-shadow:inset 0 -2px #ef984f}
.calendar td.missing{color:#81796f}.daily-empty,.pending-hint{font-size:.78rem;color:#aa9c90}
.pending-notice{padding:.75rem 1rem;border:1px solid #73582f;border-radius:.5rem;background:#30271a;color:#e4c38c;font-size:.78rem}.pending-notice p{margin:.35rem 0 0}
.pending-results{margin-top:1.3rem;border-top:1px solid #4c3a27;padding-top:.7rem}.pending-results summary{cursor:pointer;color:#e6bb81;font-size:.85rem;font-weight:600}
.pending-source small{display:block;min-width:9rem;color:#ae9e91}.daily-value{text-align:right;white-space:nowrap}
</style>
