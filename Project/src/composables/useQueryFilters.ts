import { watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { useFilterDelay } from './useFilterDelay';

/** Merge changes made within one typing pause into a single navigation. */
export function useQueryFilters() {
  const route = useRoute();
  const router = useRouter();
  const delay = useFilterDelay();
  let pending: LocationQueryRaw = {};
  let pushHistory = false;
  function cancel() { delay.cancel(); pending = {}; pushHistory = false; }
  watch(() => route.fullPath, cancel, { flush: 'sync' });
  return (changes: LocationQueryRaw, navigation: 'push' | 'replace' = 'replace') => {
    if (navigation === 'push') pushHistory = true;
    Object.assign(pending, changes);
    delay.schedule(() => {
      const changed = Object.keys(pending).some(key => key !== 'page' && key !== 'activityPage' && (route.query[key] ?? '') !== (pending[key] ?? ''));
      if (!changed) { cancel(); return; }
      const query = { ...route.query, ...pending };
      const method = pushHistory ? 'push' : 'replace';
      cancel();
      void router[method]({ query });
    });
  };
}
