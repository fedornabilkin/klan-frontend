<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>();
</script>

<template lang="pug">
header.page-header
  .page-header__copy
    p.page-header__eyebrow(v-if="eyebrow") {{ eyebrow }}
    h1 {{ title }}
    p.page-header__description(v-if="description") {{ description }}
  .page-header__actions(v-if="$slots.default || $slots.actions")
    slot(name="actions")
    slot
</template>

<style scoped>
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
.page-header__eyebrow { text-transform: uppercase; color: #e99546; letter-spacing: .17em; font-size: .6rem; font-weight: 800; margin: 0 0 .6rem; }
h1 { font-size: clamp(1.8rem, 3vw, 2.5rem); font-weight: 750; line-height: 1.15; letter-spacing: -.045em; margin: 0; color: #f0f1e9; }
.page-header__description { color: #899083; font-size: .86rem; margin: .7rem 0 0; max-width: 42rem; line-height: 1.65; }
.page-header__actions { display: flex; align-items: center; gap: .75rem; }
</style>
