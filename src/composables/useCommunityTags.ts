import { computed, onMounted, onScopeDispose, ref } from 'vue';
import type { Tag } from '@shared/contracts';
import { communityService } from '@/services/community';
import { rankCommunityTags, type TagCount } from '@/domain/tagPopularity';
import { useRealtime } from './useRealtime';

export function useCommunityTags() {
  const catalog = ref<Tag[]>([]);
  const usage = ref<TagCount[]>([]);
  const loading = ref(false);
  const error = ref('');
  const ranked = computed(() => rankCommunityTags(catalog.value, usage.value));
  const counts = computed(() => new Map(ranked.value.map(tag => [tag.id, tag.count])));
  let controller: AbortController | undefined;
  let disposed = false;

  async function refresh() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading.value = true;
    const [tags, statistics] = await Promise.allSettled([
      communityService.tags(request.signal), communityService.stats(request.signal),
    ]);
    if (disposed || request.signal.aborted) return;
    if (tags.status === 'fulfilled') catalog.value = tags.value;
    if (statistics.status === 'fulfilled') usage.value = statistics.value.interests;
    error.value = tags.status === 'rejected' ? 'Не удалось загрузить теги.'
      : statistics.status === 'rejected' ? 'Частота тегов временно недоступна.' : '';
    loading.value = false;
  }

  onMounted(() => { void refresh(); });
  useRealtime(message => {
    if (message.type === 'invalidate' && ['users', 'tags', '*'].includes(message.resource)) void refresh();
  });
  onScopeDispose(() => { disposed = true; controller?.abort(); });
  return { ranked, counts, loading, error, refresh };
}
