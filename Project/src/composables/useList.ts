import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import type { ListMeta, Resource } from '@shared/contracts';
import type { CommunityEntity, UserModel } from '@/domain/builders';
import { communityService } from '@/services/community';
import { selectedMemberFilters } from '@/domain/adminMemberFilters';
import { errorMessage } from '@/services/api';
import { useRealtime } from './useRealtime';

import { searchTerm, useFilterDelay } from './useFilterDelay';

export interface ListFilters { q: string; sort: string; status: string; category: string; tag: string; city: string; missing: string }
const keys = ['q', 'sort', 'status', 'category', 'tag', 'city', 'missing'] as const;
export function parseFilters(query: LocationQuery, defaultSort = '-createdAt', adminMembers = false): ListFilters {
  const text = (key: string, fallback = '') => typeof query[key] === 'string' ? query[key] as string : fallback;
  return { q: searchTerm(text('q')), sort: text('sort', defaultSort), status: text('status'), category: text('category'), tag: text('tag'), city: text('city'),
    missing: adminMembers ? selectedMemberFilters(text('missing')).join(',') : '' };
}
export function parsePage(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}
export function useList(resource: MaybeRefOrGetter<Resource>, options: { limit?: MaybeRefOrGetter<number>; adminMembers?: boolean } = {}) {
  const route = useRoute();
  const router = useRouter();
  const limit = computed(() => toValue(resource) === 'teams' ? 30 : toValue(options.limit) ?? 12);
  const defaultSort = computed(() => toValue(resource) === 'teams' ? 'name' : '-createdAt');
  const adminMembers = computed(() => options.adminMembers && toValue(resource) === 'users');
  const currentFilters = () => parseFilters(route.query, defaultSort.value, adminMembers.value);
  const filters = reactive<ListFilters>(currentFilters());
  const items = shallowRef<(UserModel | CommunityEntity)[]>([]);
  const meta = ref<ListMeta>({ page: 1, pages: 1, limit:limit.value, total: 0 });
  const loading = ref(false);
  const error = ref('');
  const page = computed(() => parsePage(route.query.page));
  let abort: AbortController | undefined;
  const delay = useFilterDelay();
  let requestId = 0;
  let disposed = false;
  async function refresh(): Promise<void> {
    abort?.abort();
    abort = new AbortController();
    const current = ++requestId;
    loading.value = true;
    error.value = '';
    try {
      const result = await communityService.list(adminMembers.value ? 'admin/users' : toValue(resource), { ...currentFilters(), page: page.value, limit:limit.value, view:'cards' }, abort.signal);
      if (disposed || current !== requestId) return;
      items.value = result.data;
      meta.value = result.meta;
      if (result.meta.pages > 0 && page.value > result.meta.pages) await setPage(result.meta.pages);
    } catch (cause) {
      if (disposed || current !== requestId || (cause instanceof Error && cause.name === 'AbortError')) return;
      error.value = errorMessage(cause);
    } finally { if (!disposed && current === requestId) loading.value = false; }
  }
  function setPage(value: number): Promise<unknown> {
    return router.replace({ query: { ...route.query, page: value > 1 ? String(value) : undefined } });
  }
  watch(() => ({ ...filters }), next => {
    delay.cancel();
    const original = currentFilters();
    const values = { ...next, q: searchTerm(next.q) };
    if (keys.every(key => values[key] === original[key])) return;
    delay.schedule(() => {
      const query = { ...route.query };
      for (const key of keys) {
        if (values[key] && !(key === 'sort' && values[key] === defaultSort.value)) query[key] = values[key];
        else delete query[key];
      }
      delete query.page;
      void router.replace({ query });
    });
  });
  watch([() => toValue(resource), () => route.query], ([kind], previous) => {
    delay.cancel();
    const next = currentFilters();
    if (previous?.[0] === kind && next.q === searchTerm(filters.q)) next.q = filters.q;
    Object.assign(filters, next);
    void refresh();
  }, { immediate: true });
  useRealtime(message => {
    if (message.type !== 'invalidate') return;
    const missing = adminMembers.value ? selectedMemberFilters(currentFilters().missing) : [];
    if ([toValue(resource), '*'].includes(message.resource)
      || (message.resource === 'teams' && missing.includes('teams'))
      || (message.resource === 'challenges' && (missing.includes('results') || missing.includes('teams')))) void refresh();
  });
  onScopeDispose(() => { disposed = true; abort?.abort(); });
  return { items, meta, loading, error, filters, page, refresh, setPage };
}
