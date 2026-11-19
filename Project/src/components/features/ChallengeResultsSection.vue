<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { NButton, NSelect } from 'naive-ui';
import type { Entity } from '@shared/contracts';
import { userPath } from '@shared/user-links';
import { filterChallengeResults, filterPendingChallengeResults, paginateChallengeResults, resultDateLabel, SOLO_RESULT_TEAM } from '@/domain/challengeResults';
import Pagination from '@/components/ui/Pagination.vue';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ entity: Entity }>();
const sectionId = useId();
const userId = ref<string | null>(null);
const teamId = ref<string | null>(null);
const from = ref('');
const to = ref('');
const page = ref(1);
const pendingPage = ref(1);
const results = computed(() => props.entity.results ?? []);
const pending = computed(() => props.entity.pendingResults ?? []);
const pendingTotal = computed(() => pending.value.reduce((sum, result) => sum + result.value, 0));
const unit = computed(() => props.entity.goal?.unit || 'ед.');
const hasFilters = computed(() => !!(userId.value || teamId.value || from.value || to.value));
const reversedDates = computed(() => !!from.value && !!to.value && from.value > to.value);
const userOptions = computed(() => {
  const users = new Map(props.entity.participants.map(participant => [participant.user.id, participant.user]));
  for (const result of [...results.value, ...pending.value]) if (!users.has(result.user.id)) users.set(result.user.id, result.user);
  return [...users.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru')).map(user => ({
    value: user.id,
    label: [user.name, user.callsign, user.username ? `@${user.username}` : ''].filter(Boolean).join(' · '),
  }));
});
const teamOptions = computed(() => {
  const teams = new Map<string, string>();
  for (const row of [...props.entity.participants, ...results.value, ...pending.value]) {
    teams.set(row.team?.id ?? SOLO_RESULT_TEAM, row.team?.title ?? 'Соло');
  }
  return [...teams].map(([value, label]) => ({ value, label })).sort((left, right) => left.label.localeCompare(right.label, 'ru'));
});
const filtered = computed(() => filterChallengeResults(results.value, { userId: userId.value, teamId: teamId.value, from: from.value, to: to.value }));
const selected = computed(() => paginateChallengeResults(filtered.value, page.value));
const pendingFiltered = computed(() => filterPendingChallengeResults(pending.value, { userId: userId.value, teamId: teamId.value }));
const pendingSelected = computed(() => paginateChallengeResults(pendingFiltered.value, pendingPage.value));
watch([userId, teamId, from, to], () => { page.value = 1; });
watch([userId, teamId], () => { pendingPage.value = 1; });
watch(() => selected.value.page, value => { if (page.value !== value) page.value = value; });
watch(() => pendingSelected.value.page, value => { if (pendingPage.value !== value) pendingPage.value = value; });
watch(() => props.entity.id, reset);
function reset() { userId.value = null; teamId.value = null; from.value = ''; to.value = ''; page.value = 1; pendingPage.value = 1; }
</script>

<template>
  <section class="daily-results" :aria-labelledby="`${sectionId}-heading`">
    <div class="daily-heading">
      <h2 :id="`${sectionId}-heading`"><Icon name="calendar-days" />Результаты по дням</h2>
      <NButton v-if="hasFilters" size="small" quaternary @click="reset">Сбросить фильтры</NButton>
    </div>
    <div v-if="pending.length" class="pending-notice" role="note">
      <strong>Есть результаты с неуточнённой датой</strong>
      <p>Записей: {{ pending.length.toLocaleString('ru-RU') }}. Их сумма — {{ pendingTotal.toLocaleString('ru-RU') }} {{ unit }} — пока не включена в общий результат и рейтинги.</p>
    </div>
    <div class="daily-filters">
      <div class="daily-field">
        <label :id="`${sectionId}-person-label`">Участник</label>
        <NSelect v-model:value="userId" :options="userOptions" filterable clearable placeholder="Все участники" :input-props="{ 'aria-label': 'Участник результатов' }" :aria-labelledby="`${sectionId}-person-label`" />
      </div>
      <div class="daily-field">
        <label :id="`${sectionId}-team-label`">Команда в челлендже</label>
        <NSelect v-model:value="teamId" :options="teamOptions" filterable clearable placeholder="Все команды" :input-props="{ 'aria-label': 'Команда результатов' }" :aria-labelledby="`${sectionId}-team-label`" />
      </div>
      <div class="daily-dates">
        <div class="daily-field">
          <label :for="`${sectionId}-from`">С даты</label>
          <input :id="`${sectionId}-from`" v-model="from" type="date" :min="entity.schedule?.start.slice(0, 10)" :max="entity.schedule?.end.slice(0, 10)" />
        </div>
        <div class="daily-field">
          <label :for="`${sectionId}-to`">По дату</label>
          <input :id="`${sectionId}-to`" v-model="to" type="date" :min="entity.schedule?.start.slice(0, 10)" :max="entity.schedule?.end.slice(0, 10)" />
        </div>
      </div>
    </div>
    <p v-if="reversedDates" class="daily-error" role="alert">Начальная дата должна быть не позже конечной.</p>
    <div class="daily-summary" role="status" aria-live="polite">
      <span>Записей: <strong>{{ selected.total.toLocaleString('ru-RU') }}</strong></span>
      <span>Сумма: <strong>{{ selected.value.toLocaleString('ru-RU') }}</strong> {{ unit }}</span>
    </div>
    <div v-if="selected.rows.length" class="daily-table-wrap" role="region" aria-label="Таблица результатов по дням" tabindex="0">
      <table>
        <thead><tr><th scope="col">Дата</th><th scope="col">Участник</th><th scope="col">Команда</th><th scope="col" class="daily-value">{{ unit }}</th></tr></thead>
        <tbody>
          <tr v-for="(result, index) in selected.rows" :key="`${result.user.id}:${result.date}:${selected.first + index}`">
            <td class="daily-date"><time :datetime="result.date">{{ resultDateLabel(result.date) }}</time></td>
            <td><RouterLink :to="userPath(result.user)">{{ result.user.name }}</RouterLink></td>
            <td><RouterLink v-if="result.team" :to="`/teams/${encodeURIComponent(result.team.publicId ?? result.team.id)}`">{{ result.team.title }}</RouterLink><span v-else>Соло</span></td>
            <td class="daily-value">{{ result.value.toLocaleString('ru-RU') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="daily-empty">{{ results.length ? 'По выбранным фильтрам записей нет.' : 'Результаты пока не добавлены.' }}</p>
    <div v-if="selected.total" class="daily-pagination">
      <span>Показаны {{ selected.first }}–{{ selected.last }} из {{ selected.total.toLocaleString('ru-RU') }}</span>
      <Pagination v-model:page="page" :pages="selected.pages" />
    </div>
    <details v-if="pending.length" class="pending-results">
      <summary>Требуют уточнения даты</summary>
      <p class="pending-hint">Ниже действуют фильтры участника и команды. Период не применяется, пока дата записи неизвестна. Ячейка указывает место в исходном файле.</p>
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
              <td><RouterLink :to="userPath(result.user)">{{ result.user.name }}</RouterLink></td>
              <td><RouterLink v-if="result.team" :to="`/teams/${encodeURIComponent(result.team.publicId ?? result.team.id)}`">{{ result.team.title }}</RouterLink><span v-else>Соло</span></td>
              <td class="daily-value">{{ result.value.toLocaleString('ru-RU') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="daily-empty">Для выбранного участника и команды таких записей нет.</p>
      <div v-if="pendingSelected.total" class="daily-pagination">
        <span>Показаны {{ pendingSelected.first }}–{{ pendingSelected.last }} из {{ pendingSelected.total.toLocaleString('ru-RU') }}</span>
        <Pagination v-model:page="pendingPage" :pages="pendingSelected.pages" />
      </div>
    </details>
  </section>
</template>

<style scoped>
.pending-notice{padding:.85rem 1rem;margin-bottom:1rem;border:1px solid #73582f;border-radius:.5rem;background:#30271a;color:#e4c38c;font-size:.77rem;line-height:1.6}.pending-notice strong{font-weight:600}.pending-notice p{margin:.35rem 0 0}.pending-results{margin-top:1.5rem;border-top:1px solid #4c3a27;padding-top:1rem}.pending-results>summary{cursor:pointer;color:#e6bb81;font-size:.84rem;font-weight:600;min-height:2.5rem;line-height:2.5rem}.pending-results>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.pending-hint{font-size:.74rem;color:#a69483;line-height:1.7;margin:.4rem 0 0}.pending-source{max-width:14rem;overflow-wrap:anywhere}.pending-source strong{display:block;font-size:.72rem;font-weight:600;color:#d8bd9b}.pending-source small{display:block;min-width:9rem;font-size:.67rem;color:#a89785;line-height:1.6;margin-top:.25rem}
.daily-results{min-width:0;border:1px solid #302d29;border-radius:.9rem;padding:1.5rem;background:#1a1919}.daily-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:1rem}.daily-heading h2{display:flex;align-items:center;gap:.6rem;margin:0;font-size:1rem;font-weight:650;letter-spacing:-.02em}.daily-heading h2 :deep(svg){color:#d88d52;font-size:.9rem}.daily-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem}.daily-field{display:flex;flex-direction:column;gap:.35rem;min-width:0}.daily-field label{color:#ad9c8d;font-size:.72rem}.daily-dates{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem}.daily-field input{box-sizing:border-box;min-width:0;width:100%;height:36px;border:1px solid #ffffff17;border-radius:3px;padding:0 .7rem;background:#ffffff1a;color:#eee;font:inherit;font-size:.8rem;color-scheme:dark}.daily-field input:focus{outline:1px solid var(--accent);border-color:var(--accent)}.daily-summary{display:flex;gap:.5rem 1.4rem;flex-wrap:wrap;color:#a9998c;font-size:.75rem;margin:1rem 0}.daily-summary strong{color:#e8c3a3;font-weight:600;font-variant-numeric:tabular-nums}.daily-table-wrap{overflow:auto;max-width:100%;border:1px solid #3a3028;border-radius:.5rem}.daily-table-wrap:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.daily-table-wrap table{width:100%;border-collapse:collapse;font-size:.77rem;text-align:left;line-height:1.5}.daily-table-wrap th{font-size:.66rem;color:#a58e7a;font-weight:500;background:#221e1b}.daily-table-wrap td{color:#c4b7ab}.daily-table-wrap th,.daily-table-wrap td{padding:.7rem .65rem;border-bottom:1px solid #ffffff09;vertical-align:top}.daily-table-wrap tr:last-child td{border-bottom:0}.daily-table-wrap a{color:#dec1a9;text-decoration:none;overflow-wrap:anywhere}.daily-table-wrap a:hover{color:#ffca9f;text-decoration:underline}.daily-table-wrap a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.daily-table-wrap .daily-date{white-space:nowrap;font-variant-numeric:tabular-nums}.daily-table-wrap .daily-value{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.daily-pagination{display:flex;flex-direction:column;gap:.75rem;align-items:center;margin-top:1rem}.daily-pagination>span{color:#97887b;font-size:.7rem}.daily-pagination :deep(.pagination){margin-top:0}.daily-empty{margin:.7rem 0;color:#97887b;font-size:.8rem;line-height:1.6}.daily-error{color:#f2a19b;font-size:.78rem;margin:.8rem 0}.daily-results :deep(.n-button){min-height:2.75rem}@media(max-width:58rem){.daily-results{padding:1.15rem}.daily-table-wrap th,.daily-table-wrap td{padding:.6rem .5rem}}@media(max-width:38rem){.daily-filters{grid-template-columns:1fr}.daily-table-wrap table{min-width:32rem}.daily-dates{gap:.6rem}.daily-pagination :deep(.pagination){gap:.2rem}}
</style>
