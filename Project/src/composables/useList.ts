import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import type { ListMeta, Resource } from '@shared/contracts';
import type { CommunityEntity, UserModel } from '@/domain/builders';
import { communityService } from '@/services/community';
import { errorMessage } from '@/services/api';
import { useRealtime } from './useRealtime';

export interface ListFilters { q: string; sort: string; status: string; category: string; tag: string; city: string }
const keys = ['q', 'sort', 'status', 'category', 'tag', 'city'] as const;
export function parseFilters(query: LocationQuery): ListFilters {
  const text = (key: string, fallback = '') => typeof query[key] === 'string' ? query[key] as string : fallback;
  return { q: text('q'), sort: text('sort', '-createdAt'), status: text('status'), category: text('category'), tag: text('tag'), city: text('city') };
}
export function parsePage(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}
export function useList(resource: MaybeRefOrGetter<Resource>, options: { limit?: MaybeRefOrGetter<number> } = {}) {
  const route = useRoute();
  const router = useRouter();
  const limit = computed(() => toValue(resource) === 'teams' ? 30 : toValue(options.limit) ?? 12);
  const filters = reactive<ListFilters>(parseFilters(route.query));
  const items = shallowRef<(UserModel | CommunityEntity)[]>([]);
  const meta = ref<ListMeta>({ page: 1, pages: 1, limit:limit.value, total: 0 });
  const loading = ref(false);
  const error = ref('');
  const page = computed(() => parsePage(route.query.page));
  let abort: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;
  let disposed = false;
  async function refresh(): Promise<void> {
    abort?.abort();
    abort = new AbortController();
    const current = ++requestId;
    loading.value = true;
    error.value = '';
    try {
      const result = await communityService.list(toValue(resource), { ...parseFilters(route.query), page: page.value, limit:limit.value, view:'cards' }, abort.signal);
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
  watch(() => ({ ...filters }), (next, previous) => {
    const original = parseFilters(route.query);
    if (keys.every(key => next[key] === original[key])) return;
    if (timer) clearTimeout(timer);
    const synchronize = () => {
      const query = { ...route.query };
      for (const key of keys) {
        if (filters[key] && !(key === 'sort' && filters[key] === '-createdAt')) query[key] = filters[key];
        else delete query[key];
      }
      delete query.page;
      void router.replace({ query });
    };
    if (next.q !== previous.q) timer = setTimeout(synchronize, 280);
    else synchronize();
  });
  watch([() => toValue(resource), () => route.query], () => {
    if (timer) clearTimeout(timer);
    Object.assign(filters, parseFilters(route.query));
    void refresh();
  }, { immediate: true });
  useRealtime(message => {
    if (message.type === 'invalidate' && [toValue(resource), '*'].includes(message.resource)) void refresh();
  });
  onScopeDispose(() => { disposed = true; abort?.abort(); if (timer) clearTimeout(timer); });
  return { items, meta, loading, error, filters, page, refresh, setPage };
}
