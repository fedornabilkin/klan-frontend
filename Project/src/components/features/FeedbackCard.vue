<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { Entity } from '@shared/contracts';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import EntityLikeButton from './EntityLikeButton.vue';
import FeedbackStatusActions from './FeedbackStatusActions.vue';
import { categoryLabels } from './resourceMeta';

const props = defineProps<{ entity: Entity }>();
const emit = defineEmits<{ statusChanged: [id: string, status: string] }>();
const createdLabel = computed(() => {
  const time = Date.parse(props.entity.createdAt);
  return Number.isFinite(time) ? new Date(time).toLocaleString('ru-RU', {dateStyle: 'long', timeStyle: 'short'}) : '';
});
</script>

<template lang="pug">
article.feedback-card.resource-card.feedback-preview
  .feedback-top
    EntityLikeButton(v-if="entity.likes" :entity="entity" :summary="entity.likes")
    StatusBadge(:status="entity.status")
  h3
    RouterLink.card-title-link(:to="`/feedback/${entity.publicId ?? entity.id}`") {{ entity.title }}
  p.description(v-if="entity.description") {{ entity.description }}
  .feedback-tags(v-if="entity.tags.length")
    span(v-for="tag in entity.tags.slice(0, 3)" :key="tag.id") {{ tag.name }}
  footer
    .feedback-meta
      span(v-if="entity.category") {{ categoryLabels[entity.category] || entity.category }}
      time(v-if="createdLabel" :datetime="entity.createdAt") {{ createdLabel }}
      span(v-else) Дата не указана
    FeedbackStatusActions(:entity="entity" @status-changed="(id, status) => emit('statusChanged', id, status)")
</template>

<style scoped>
.feedback-card { position: relative; display: flex; flex-direction: column; min-width: 0; gap: .85rem; }
.feedback-preview { padding: 1.2rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface); }
.feedback-preview:hover, .feedback-preview:focus-within { border-color: #80613f; }
.feedback-top { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; }
.feedback-top :deep(.status-badge) { margin-inline-start: auto; }
.feedback-card h3, .feedback-card h2 { margin: 0; font-size: 1.05rem; overflow-wrap: anywhere; }
.card-title-link { color: inherit; text-decoration: none; }
.card-title-link::after { content: ''; position: absolute; inset: 0; border-radius: 1rem; }
.card-title-link:focus-visible::after { outline: 2px solid var(--accent); outline-offset: 2px; }
.feedback-preview :deep(.entity-like), .feedback-preview :deep(.feedback-status-buttons button) { position: relative; z-index: 1; }
.description { margin: 0; color: var(--muted); font-size: .86rem; line-height: 1.7; overflow-wrap: anywhere; white-space: pre-line; }
.feedback-preview .description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.feedback-tags { display: flex; flex-wrap: wrap; gap: .35rem; }
.feedback-tags span { padding: .22rem .5rem; border-radius: .3rem; background: #282626; color: #c2b9b4; font-size: .7rem; }
footer { display: flex; align-items: flex-end; flex-wrap: wrap; gap: .65rem 1rem; margin-top: auto; padding-top: .85rem; border-top: 1px solid var(--border); }
.feedback-meta { display: grid; gap: .2rem; color: var(--muted); font-size: .76rem; }
</style>
