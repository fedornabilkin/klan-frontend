<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TeamChallengeSummary } from '@shared/contracts';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ active?: TeamChallengeSummary[]; finished?: TeamChallengeSummary[] }>();
const choice = ref('');
const challenges = computed(() => [...(props.active ?? []), ...(props.finished ?? [])]);
const current = computed(() => challenges.value.find(row => row.id === choice.value) ?? challenges.value[0]);
const inProgress = computed(() => props.active?.some(row => row.id === current.value?.id));
const percent = new Intl.NumberFormat('ru-RU', { style:'percent', maximumFractionDigits:1 });
</script>

<template>
  <section v-if="current" class="team-progress" aria-label="Выполнение челленджа">
    <div class="progress-heading">
      <label v-if="challenges.length > 1">Челлендж
        <select :value="current.id" @change="choice = ($event.target as HTMLSelectElement).value">
          <optgroup v-if="active?.length" label="Текущие"><option v-for="row in active" :key="row.id" :value="row.id">{{ row.title }}</option></optgroup>
          <optgroup v-if="finished?.length" label="Завершённые"><option v-for="row in finished" :key="row.id" :value="row.id">{{ row.title }}</option></optgroup>
        </select>
      </label>
      <span v-else>{{ inProgress ? 'Текущий челлендж' : 'Завершённый челлендж' }}</span>
      <RouterLink :to="'/challenges/' + (current.publicId ?? current.id)" :aria-label="current.title">
        <template v-if="challenges.length === 1">{{ current.title }}</template>
        <Icon v-else name="arrow-up-right-from-square" />
      </RouterLink>
    </div>
    <dl class="progress-metrics">
      <div v-if="current.personalTarget != null"><dt>Цель на участника</dt><dd>{{ current.personalTarget.toLocaleString('ru-RU') }} {{ current.unit }}</dd></div>
      <div v-if="current.members != null"><dt>Участников в зачёте</dt><dd>{{ current.members.toLocaleString('ru-RU') }}</dd></div>
      <div v-if="current.target != null"><dt><Icon name="bullseye" />Цель команды</dt><dd>{{ current.target.toLocaleString('ru-RU') }} {{ current.unit }}</dd></div>
      <div><dt><Icon name="trophy" />Факт</dt><dd>{{ current.score.toLocaleString('ru-RU') }} {{ current.unit }}</dd></div>
      <div v-if="current.target != null && current.target > 0"><dt>Выполнение</dt><dd>{{ percent.format(current.score / current.target) }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.team-progress{box-sizing:border-box;width:fit-content;max-width:100%;margin:1.15rem 0 0 auto;border-top:1px solid var(--border);padding-top:.8rem}
.progress-heading{display:flex;align-items:center;justify-content:flex-end;gap:.35rem .65rem;flex-wrap:wrap;font-size:.78rem}
.progress-heading span,.progress-heading label{color:var(--muted)}.progress-heading a{color:#edb38a;overflow-wrap:anywhere}
.progress-heading label{display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;min-width:0;max-width:100%}
.progress-heading select{min-width:0;max-width:100%;font:inherit;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:.35rem;padding:.3rem}
.progress-metrics{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.6rem 1rem;margin:.75rem 0 0}
.progress-metrics dt{display:flex;align-items:center;gap:.25rem;color:var(--muted);font-size:.68rem}.progress-metrics dd{font-size:.87rem;font-weight:650;font-variant-numeric:tabular-nums;margin:.15rem 0 0}
@media(max-width:40rem){.team-progress{width:100%}.progress-metrics{gap:.6rem .85rem}}
</style>
