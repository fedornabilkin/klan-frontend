<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import { paginationItems } from './pagination';
const props = defineProps<{ page: number; pages: number }>();
const emit = defineEmits<{ change: [value: number]; 'update:page': [value: number] }>();
const items = computed(() => paginationItems(props.page, props.pages));
function select(page: number): void { if (page === props.page) return; emit('change', page); emit('update:page', page); }
</script>

<template lang="pug">
nav.pagination(v-if="pages > 1" aria-label="Страницы списка")
  button.pagination__button(type="button" :disabled="page <= 1" aria-label="Предыдущая страница" @click="select(page - 1)")
    Icon(name="chevron-left")
  template(v-for="item in items" :key="item")
    span.pagination__ellipsis(v-if="typeof item === 'string'" aria-hidden="true") …
    button.pagination__button(v-else type="button" :class="{ 'is-current': item === page }" :aria-current="item === page ? 'page' : undefined" :aria-label="`Страница ${item}`" @click="select(item)") {{ item }}
  button.pagination__button(type="button" :disabled="page >= pages" aria-label="Следующая страница" @click="select(page + 1)")
    Icon(name="chevron-right")
</template>

<style scoped>
.pagination { display: flex; justify-content: center; align-items: center; gap: .25rem; flex-wrap: wrap; margin-top: 2rem; }
.pagination__button { min-width: 2.75rem; height: 2.75rem; border: 1px solid #ffffff14; border-radius: .6rem; color: #a5aaa3; background: #191c19; cursor: pointer; font: inherit; font-size: .8rem; transition: .18s ease; }
.pagination__button:hover:not(:disabled) { border-color: #ff7a00; color: #ff9433; }
.pagination__button.is-current { background: #ff7a00; color: #111; border-color: #ff7a00; font-weight: 800; }
.pagination__button:disabled { opacity: .35; cursor: default; }
.pagination__ellipsis { width: 1.5rem; text-align: center; color: #73796f; }
</style>
