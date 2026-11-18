<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsCount } from '@shared/analytics';
import EmptyState from '@/components/ui/EmptyState.vue';
const props = withDefaults(defineProps<{ values: AnalyticsCount[]; empty?: string }>(), { empty: 'Нет данных' });
const maximum = computed(() => Math.max(1, ...props.values.map(value => value.count)));
</script>

<template lang="pug">
.analytics-bars(v-if="values.length")
  .analytics-bar(v-for="value in values" :key="value.name")
    .analytics-bar__label
      span {{ value.name }}
      strong {{ value.count.toLocaleString('ru-RU') }}
    .analytics-bar__track
      span(:style="{width: `${value.count / maximum * 100}%`}")
EmptyState(v-else :title="empty")
</template>

<style scoped>
.analytics-bars{display:grid;gap:.95rem}.analytics-bar__label{display:flex;justify-content:space-between;gap:1rem;font-size:.8rem;margin-bottom:.4rem}.analytics-bar__label span{overflow-wrap:anywhere}.analytics-bar__label strong{color:#e9a065}.analytics-bar__track{height:.35rem;border-radius:.3rem;background:#ffffff08;overflow:hidden}.analytics-bar__track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#b75520,#fa8a38)}
</style>
