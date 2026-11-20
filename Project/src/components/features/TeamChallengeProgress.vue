<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TeamChallengeSummary } from '@shared/contracts';
import ChallengeMetric from '@/components/ui/ChallengeMetric.vue';
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
    <div class="progress-metrics">
      <ChallengeMetric v-if="current.personalTarget != null" icon="user" label="Цель на участника" :value="current.personalTarget" :unit="current.unit" />
      <ChallengeMetric v-if="current.members != null" icon="users" label="Участников в зачёте" :value="current.members" />
      <ChallengeMetric v-if="current.target != null" icon="bullseye" label="Цель команды" :value="current.target" :unit="current.unit" />
      <ChallengeMetric icon="trophy" label="Результат команды" :value="current.score" :unit="current.unit" />
      <ChallengeMetric v-if="current.target != null && current.target > 0" icon="chart-simple" label="Выполнение цели" :value="percent.format(current.score / current.target)" />
    </div>
  </section>
</template>

<style scoped>
.team-progress{box-sizing:border-box;width:fit-content;max-width:100%;margin:1.15rem 0 0 auto;border-top:1px solid var(--border);padding-top:.8rem}
.progress-heading{display:flex;align-items:center;justify-content:flex-end;gap:.35rem .65rem;flex-wrap:wrap;font-size:.78rem}
.progress-heading span,.progress-heading label{color:var(--muted)}.progress-heading a{color:#edb38a;overflow-wrap:anywhere}
.progress-heading label{display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;min-width:0;max-width:100%}
.progress-heading select{min-width:0;max-width:100%;font:inherit;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:.35rem;padding:.3rem}
.progress-metrics{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.25rem 1rem;font-size:.87rem;margin:.65rem 0 0}
@media(max-width:40rem){.team-progress{width:100%}.progress-metrics{gap:.6rem .85rem}}
</style>
