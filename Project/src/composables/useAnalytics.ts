import { searchTerm } from './useFilterDelay';
import { useQueryFilters } from './useQueryFilters';
import { computed, onScopeDispose, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ApiResponse } from '@shared/contracts';
import type { AnalyticsMembers, CommunityAnalytics, MemberAnalytics } from '@shared/analytics';
import { api, errorMessage } from '@/services/api';
import { useRealtime } from './useRealtime';

const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const positive = (value: unknown, fallback = 1) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) <= 100000 ? Number(value) : fallback;

function resource<T>() {
  const data = ref<T | null>(null);
  const loading = ref(false);
  const error = ref('');
  let controller: AbortController | undefined;
  let sequence = 0;
  async function load(path: string, query: Record<string, unknown>, envelope = true) {
    controller?.abort();
    controller = new AbortController();
    const current = ++sequence;
    loading.value = true;
    error.value = '';
    try {
      const result = await api.get<ApiResponse<T> | T>(path, query, controller.signal);
      if (sequence === current) data.value = (envelope ? (result as ApiResponse<T>).data : result as T) as typeof data.value;
    } catch (cause) {
      if (sequence === current && !controller.signal.aborted) error.value = errorMessage(cause);
    } finally { if (sequence === current) loading.value = false; }
  }
  function clear() { controller?.abort(); ++sequence; data.value = null; loading.value = false; error.value = ''; }
  onScopeDispose(clear);
  return { data, loading, error, load, clear };
}

export function useAnalytics() {
  const route = useRoute();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const range = computed(() => {
    const to = text(route.query.to, today);
    const end = Date.parse(`${to}T00:00:00Z`);
    const defaultFrom = Number.isFinite(end) ? new Date(end - 29 * 86400000).toISOString().slice(0, 10) : daysAgo(30);
    return { from: text(route.query.from, defaultFrom), to };
  });
  const q = computed(() => searchTerm(text(route.query.q)));
  const sort = computed(() => text(route.query.sort, '-actions'));
  const activity = computed(() => text(route.query.activity, 'all'));
  const page = computed(() => positive(route.query.page));
  const limit = computed(() => { const value = positive(route.query.limit, 12); return value <= 50 ? value : 12; });
  const selected = computed(() => text(route.query.member));
  const activityPage = computed(() => positive(route.query.activityPage));
  const rangeDraft = reactive({ ...range.value });
  const search = ref(q.value);
  const rangeError = ref('');
  const community = resource<CommunityAnalytics>();
  const members = resource<AnalyticsMembers>();
  const detail = resource<MemberAnalytics>();
  const applyFilters = useQueryFilters();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  function update(changes: Record<string, string | number | undefined>, replace = true) {
    const query = { ...route.query };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') delete query[key];
      else query[key] = String(value);
    }
    return router[replace ? 'replace' : 'push']({ query });
  }
  function applyRange() {
    rangeError.value = '';
    const start = Date.parse(`${rangeDraft.from}T00:00:00Z`);
    const end = Date.parse(`${rangeDraft.to}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      rangeError.value = 'Укажите корректные даты: начало не позднее окончания.';
      return;
    }
    if (rangeDraft.to > today) { rangeError.value = 'Дата окончания не может быть в будущем.'; return; }
    if ((end - start) / 86400000 + 1 > 366) { rangeError.value = 'Выберите период не более 366 дней.'; return; }
    applyFilters({ ...rangeDraft, page: undefined, activityPage: undefined }, 'push');
  }
  function quickRange(days: number) { Object.assign(rangeDraft, { from: daysAgo(days), to: today }); applyRange(); }
  const memberParams = computed(() => ({ ...range.value, q: q.value, sort: sort.value, activity: activity.value, page: page.value, limit: limit.value }));
  const detailParams = computed(() => ({ ...range.value, activityPage: activityPage.value, activityLimit: 10 }));
  function loadCommunity() { return community.load('/admin/analytics/community', range.value); }
  function loadMembers() { return members.load('/admin/analytics/members', memberParams.value, false); }
  function loadDetail() {
    if (!selected.value) { detail.clear(); return; }
    return detail.load(`/admin/analytics/members/${encodeURIComponent(selected.value)}`, detailParams.value);
  }
  function refresh() { void loadCommunity(); void loadMembers(); void loadDetail(); }

  watch(() => `${range.value.from}|${range.value.to}`, () => { Object.assign(rangeDraft, range.value); rangeError.value = ''; void loadCommunity(); }, { immediate: true });
  watch(() => JSON.stringify(memberParams.value), () => { void loadMembers(); }, { immediate: true });
  watch(() => `${selected.value}|${JSON.stringify(detailParams.value)}`, () => { detail.clear(); void loadDetail(); }, { immediate: true });
  watch(q, value => { if (searchTerm(search.value) !== value) search.value = value; });
  watch(search, value => { applyFilters({ q: searchTerm(value) || undefined, page: undefined }); });
  useRealtime(message => {
    if (message.type !== 'invalidate') return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 350);
  });
  onScopeDispose(() => { if (refreshTimer) clearTimeout(refreshTimer); });

  return {
    community, members, detail, today, range, rangeDraft, rangeError, search, sort, activity, page, limit, selected,
    applyRange, quickRange, refresh, loadCommunity, loadMembers, loadDetail,
    setSort: (value: string) => applyFilters({ sort: value, page: undefined }),
    setActivity: (value: string) => applyFilters({ activity: value, page: undefined }),
    setPage: (value: number) => update({ page: value === 1 ? undefined : value }, false),
    openMember: (id: string) => update({ member: id, activityPage: undefined }, false),
    closeMember: () => update({ member: undefined, activityPage: undefined }),
    setActivityPage: (value: number) => update({ activityPage: value === 1 ? undefined : value }, false),
  };
}
