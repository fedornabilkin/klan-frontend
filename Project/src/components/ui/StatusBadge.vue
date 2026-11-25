<script setup lang="ts">
import { computed } from 'vue';
import { statusLabel } from '@/domain/entityStatus';
const props = defineProps<{ status: string }>();
const label = computed(() => statusLabel(props.status));
</script>

<template lang="pug">
span.status-badge(v-if="status" :class="`status-badge--${status}`")
  span.status-badge__dot
  | {{ label }}
</template>

<style scoped>
.status-badge { display: inline-flex; align-items: center; gap: .4rem; padding: .25rem .55rem; border-radius: .35rem; background: #ffffff06; border: 1px solid #ffffff10; font-size: .65rem; font-weight: 700; white-space: nowrap; color: #9ba098; }
.status-badge__dot { width: .3rem; height: .3rem; border-radius: 50%; background: currentColor; }
.status-badge--active, .status-badge--published, .status-badge--approved, .status-badge--resolved { color: #a8bf7a; background: #9eb86e12; border-color: #9eb86e20; }
.status-badge--upcoming, .status-badge--planned, .status-badge--new, .status-badge--open, .status-badge--review, .status-badge--in-progress, .status-badge--in_progress { color: #eaa767; background: #eaa7670d; border-color: #eaa76720; }
</style>
