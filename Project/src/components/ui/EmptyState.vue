<script setup lang="ts">
import Icon from './Icon.vue';
withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), { icon: 'compass' });
</script>

<template lang="pug">
.empty-state
  .empty-state__icon
    Icon(:name="icon")
  h3 {{ title }}
  p(v-if="description") {{ description }}
  slot
</template>

<style scoped>
.empty-state { text-align: center; padding: 3rem 1rem; color: #929a90; }
.empty-state__icon { width: 3.5rem; height: 3.5rem; display: grid; place-items: center; border-radius: 1rem; background: #ffffff04; border: 1px solid #ffffff10; margin: 0 auto 1rem; font-size: 1.25rem; color: #b97f48; }
h3 { color: #e1e6dd; font-size: 1.1rem; margin: 0 0 .5rem; } p { max-width: 26rem; margin: 0 auto 1rem; font-size: .85rem; line-height: 1.65; }
</style>
