import { computed, toValue, watch, type MaybeRefOrGetter, onScopeDispose, ref } from 'vue';
import type { Tag } from '@shared/contracts';
import { communityService } from '@/services/community';
import { rankCommunityTags, type TagCount } from '@/domain/tagPopularity';
import { useRealtime } from './useRealtime';

export function useCommunityTags(enabled: MaybeRefOrGetter<boolean> = true) {
  const catalog = ref<Tag[]>([]);
  const usage = ref<TagCount[]>([]);
  const loading = ref(false);
  const error = ref('');
  const ranked = computed(() => rankCommunityTags(catalog.value, usage.value));
  const counts = computed(() => new Map(ranked.value.map(tag => [tag.id, tag.count])));
  let controller: AbortController | undefined;
  let disposed = false;

  async function refresh() {
    if (!toValue(enabled)) return;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading.value = true;
    try {
      const rows = await communityService.tagUsage(request.signal);
      if (disposed || request.signal.aborted) return;
      catalog.value = rows;
      usage.value = rows;
      error.value = '';
    } catch {
      if (disposed || request.signal.aborted) return;
      error.value = 'Не удалось загрузить теги.';
    }
    loading.value = false;
  }

  watch(() => toValue(enabled), active => {
    if (active) void refresh();
    else { controller?.abort(); loading.value = false; }
  }, { immediate: true });
  useRealtime(message => {
    if (message.type === 'invalidate' && ['users', 'tags', '*'].includes(message.resource)) void refresh();
  });
  onScopeDispose(() => { disposed = true; controller?.abort(); });
  return { ranked, counts, loading, error, refresh };
}
