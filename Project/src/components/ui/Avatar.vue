<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(defineProps<{
  user?: { name?: string; initials?: string; color?: string } | null;
  size?: 'sm' | 'md' | 'lg';
}>(), { size: 'md' });
const initials = computed(() => props.user?.initials || props.user?.name?.split(' ').slice(0, 2).map(v => v[0]).join('') || 'К');
</script>

<template lang="pug">
span.avatar(:class="`avatar--${size}`" :style="{ '--avatar-color': user?.color || '#b57439' }" :data-tooltip="user?.name" aria-hidden="true") {{ initials }}
</template>

<style scoped>
.avatar { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 2.65rem; height: 2.65rem; border-radius: 50%; font-size: .8rem; font-weight: 800; letter-spacing: -.025em; color: var(--avatar-color); background: color-mix(in srgb, var(--avatar-color) 18%, #171b17); border: 1px solid color-mix(in srgb, var(--avatar-color) 28%, transparent); }
.avatar--sm { width: 2rem; height: 2rem; font-size: .64rem; }
.avatar--lg { width: 5rem; height: 5rem; font-size: 1.5rem; }
</style>
