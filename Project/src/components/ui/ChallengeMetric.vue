<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ icon: string; label: string; value: number | string; unit?: string }>();
const number = computed(() => props.value.toLocaleString('ru-RU'));
const hint = computed(() => [props.label, [number.value, props.unit].filter(Boolean).join(' ')].join(' — '));
</script>

<template>
  <span class="challenge-metric" tabindex="0" role="img" :aria-label="hint" :data-tooltip="hint">
    <Icon :name="icon" /><span>{{ number }}</span>
  </span>
</template>

<style scoped>
.challenge-metric{display:inline-flex;align-items:center;gap:.38rem;min-height:1.5rem;font-variant-numeric:tabular-nums;font-weight:650;line-height:1.2;color:var(--text)}
.challenge-metric :deep(svg){width:.92em;color:#da9f70}
</style>
