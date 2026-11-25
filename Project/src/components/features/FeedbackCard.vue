<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { Entity } from '@shared/contracts';
import { communityService } from '@/services/community';
import { errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import EntityLikeButton from './EntityLikeButton.vue';
import FeedbackStatusButtons from './FeedbackStatusButtons.vue';
import { categoryLabels } from './resourceMeta';

const props = defineProps<{ entity: Entity; preview?: boolean }>();
const emit = defineEmits<{ statusChanged: [id: string, status: string] }>();
const auth = useAuthStore();
const busy = ref(false);
const error = ref('');
const createdLabel = computed(() => {
  const time = Date.parse(props.entity.createdAt);
  return Number.isFinite(time) ? new Date(time).toLocaleString('ru-RU', {dateStyle: 'long', timeStyle: 'short'}) : '';
});
async function changeStatus(status: string) {
  if (!auth.isAdmin || busy.value || status === props.entity.status) return;
  busy.value = true;
  error.value = '';
  const id = props.entity.id;
  try {
    const saved = await communityService.setFeedbackStatus(id, status);
    emit('statusChanged', id, saved);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template lang="pug">
article.feedback-card(:class="preview ? 'resource-card feedback-preview' : 'detail-panel'")
  .feedback-top
    EntityLikeButton(v-if="entity.likes" :entity="entity" :summary="entity.likes")
    StatusBadge(:status="entity.status")
  h3(v-if="preview")
    RouterLink.card-title-link(:to="`/feedback/${entity.publicId ?? entity.id}`") {{ entity.title }}
  h2(v-else) Подробности
  p.description(v-if="entity.description") {{ entity.description }}
  p.description(v-if="!preview && entity.content") {{ entity.content }}
  .feedback-tags(v-if="entity.tags.length")
    span(v-for="tag in (preview ? entity.tags.slice(0, 3) : entity.tags)" :key="tag.id") {{ tag.name }}
  footer
    .feedback-meta
      span(v-if="preview && entity.category") {{ categoryLabels[entity.category] || entity.category }}
      span(v-if="!preview") Создана · ваше время
      time(v-if="createdLabel" :datetime="entity.createdAt") {{ createdLabel }}
      span(v-else) Дата не указана
    FeedbackStatusButtons(v-if="auth.isAdmin" :status="entity.status" :busy="busy" @select="changeStatus")
    small(v-if="error" role="alert") {{ error }}
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
footer :deep(.feedback-status-buttons) { margin-inline-start: auto; justify-content: flex-end; }
footer small { flex-basis: 100%; text-align: end; color: #f2a19b; }
</style>
