import { computed, onScopeDispose, ref, watch } from 'vue';
import type { Entity } from '@shared/contracts';
import { resultPeriod } from '@/domain/challengeResults';

export function useChallengeResultPeriod(entity: () => Entity | undefined) {
  const now = ref(new Date());
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    clearTimeout(timer);
    now.value = new Date();
    const schedule = entity()?.schedule;
    if (!schedule) return;
    const midnight = new Date(now.value);
    midnight.setUTCHours(24, 0, 0, 0);
    const next = [midnight.getTime(), Date.parse(schedule.start), Date.parse(schedule.end)]
      .filter(time => time > now.value.getTime());
    timer = setTimeout(refresh, Math.min(...next) - now.value.getTime());
  }
  watch([() => entity()?.schedule?.start, () => entity()?.schedule?.end], refresh, {immediate:true});
  onScopeDispose(() => clearTimeout(timer));
  return computed(() => resultPeriod(entity(), now.value));
}
