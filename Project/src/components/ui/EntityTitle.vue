<script setup lang="ts">
import { computed } from 'vue';
import { statusLabel } from '@/domain/entityStatus';

const props = defineProps<{ title: string; status: string }>();
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ru') : undefined;
const prefix = computed(() => {
  if (!segmenter) return Array.from(props.title).slice(0, 2).join('');
  const letters = segmenter.segment(props.title)[Symbol.iterator]();
  return (letters.next().value?.segment ?? '') + (letters.next().value?.segment ?? '');
});
const active = computed(() => ['active', 'published', 'open', 'approved', 'new', 'review', 'in-progress', 'in_progress'].includes(props.status));
</script>

<template>
  <h1 :aria-label="title + ' — ' + statusLabel(status)"><span class="status-prefix" :class="{ active }" tabindex="0"
    :data-tooltip="statusLabel(status)" :aria-label="statusLabel(status)">{{ prefix }}</span>{{ title.slice(prefix.length) }}</h1>
</template>

<style scoped>
.status-prefix{position:relative}
.status-prefix::after{content:'';position:absolute;left:0;right:0;bottom:-.08em;height:3px;border-radius:3px;background:#878b88}
.status-prefix.active::after{background:#78c595}
</style>
