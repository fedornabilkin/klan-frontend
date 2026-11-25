<script setup lang="ts">
import { computed } from 'vue';
import type { Entity } from '@shared/contracts';
import EntityTitle from '@/components/ui/EntityTitle.vue';
import Icon from '@/components/ui/Icon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';

const props = defineProps<{ entity?: Entity; status?: string }>();
const showPublication = computed(() => props.entity?.type !== 'challenges' && props.entity?.type !== 'events');
const published = computed(() => {
  if (!showPublication.value) return '';
  const date = new Date(props.entity?.createdAt ?? '');
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {dateStyle:'short', timeStyle:props.entity?.type === 'feedback' ? 'short' : undefined});
});
</script>

<template lang="pug">
article.detail-card.detail-panel
  header.detail-card-head
    .detail-card-title(:class="{ 'with-leading': $slots.leading }")
      slot(name="leading")
      slot(name="title")
        EntityTitle(v-if="entity?.status" :title="entity.title" :status="status ?? entity.status")
        h1(v-else-if="entity") {{ entity.title }}
    .publication(v-if="entity && (published || entity.status || (showPublication && entity.author))")
      .publication-line
        time(v-if="published" :datetime="entity.createdAt" :aria-label="'Опубликовано: ' + published" data-tooltip="Дата публикации · ваше время")
          Icon(name="calendar")
          | {{ published }}
        StatusBadge(v-if="entity.status" :status="status ?? entity.status")
      .publication-author(v-if="showPublication && entity.author")
        span Автор публикации
        UserAvatar(:user="entity.author")
  .detail-card-body
    slot
  footer.detail-card-actions(v-if="$slots.actions")
    slot(name="actions")
</template>

<style scoped>
.detail-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .65rem 1rem; }
.detail-card-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.detail-card-title :deep(h1) { margin: 0; font-size: clamp(1.45rem, 3vw, 2.15rem); line-height: 1.18; letter-spacing: -.035em; }
.detail-card-title.with-leading { display: flex; flex-wrap: wrap; gap: .55rem; align-items: flex-start; }
.with-leading :deep(h1) { flex: 1 1 9rem; }
.publication { display: grid; grid-template-columns: minmax(0, 1fr); justify-items: end; gap: .55rem; min-width: 0; max-width: 49%; }
.publication-line, .publication-author { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: .4rem .6rem; }
.publication-line { flex-wrap: nowrap; max-width: 100%; }
.publication-line time { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .35rem; }
.publication-line time, .publication-author > span { font-size: .74rem; color: var(--muted); }
.publication-author { min-width: 0; max-width: 100%; }
.publication-author :deep(.user-avatar-name) { overflow-wrap: anywhere; }
.detail-card-body { margin-top: 1rem; overflow-wrap: anywhere; }
.detail-card-actions { display: flex; justify-content: flex-end; align-items: flex-end; flex-wrap: wrap; gap: .65rem; margin-top: 1rem; padding-top: .8rem; border-top: 1px solid var(--border); }
@media(max-width:38rem) {
  .detail-card-head { gap: .55rem; }
  .publication { max-width: 68%; }
  .publication-line { gap: .35rem; }
  .publication-line time { display: block; text-align: end; }
  .publication-line time :deep(svg) { display: none; }
  .publication-author { flex-direction: column; align-items: flex-end; }
}
</style>
