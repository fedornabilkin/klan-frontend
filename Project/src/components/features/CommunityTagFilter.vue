<script setup lang="ts">
import { computed } from 'vue';
import CommunityTagSelect from './CommunityTagSelect.vue';
import Icon from '@/components/ui/Icon.vue';
import type { RankedTag } from '@/domain/tagPopularity';

const props = defineProps<{
  tags: RankedTag[];
  loading?: boolean;
  error?: string;
}>();
const query = defineModel<string>('query', { required: true });
const selected = defineModel<string[]>({ required: true });
const emit = defineEmits<{ retry: [] }>();
const popular = computed(() => props.tags.filter(tag => tag.count > 0).slice(0, 4));
function toggle(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id];
}
</script>

<template>
  <div class="community-tag-filter">
    <div class="tag-filter-controls">
      <div class="map-search">
        <Icon name="magnifying-glass" />
        <input v-model="query" placeholder="Найти участника (от 3 символов)" aria-label="Поиск участников по имени, городу или интересам" />
        <button v-if="query" type="button" class="icon-button" aria-label="Очистить поиск" @click="query = ''"><Icon name="xmark" /></button>
      </div>
      <CommunityTagSelect v-model="selected" :tags="tags" :loading="loading" />
    </div>
    <div class="popular-tags" role="group" aria-label="Фильтры по тегам">
      <button v-for="tag in popular" :key="tag.id" type="button" class="popular-tag" :class="{ selected: selected.includes(tag.id) }" :aria-pressed="selected.includes(tag.id)" :title="`${tag.name}: ${tag.count} участников`" @click="toggle(tag.id)">
        <span>{{ tag.name }}</span><span class="tag-count">{{ tag.count }}</span>
      </button>
      <button v-if="selected.length" type="button" class="clear-tags" @click="selected = []">Сбросить теги</button>
    </div>
    <div v-if="error" class="tag-filter-error" role="status"><span>{{ error }}</span><button type="button" @click="emit('retry')">Повторить</button></div>
  </div>
</template>

<style scoped>
.map-search,.map-search input{min-width:0}
.tag-filter-controls{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:center;gap:clamp(.35rem,1vw,.75rem)}
.community-tag-filter{display:grid;gap:.65rem;min-width:0}.clear-tags,.tag-filter-error button{border:0;background:none;color:#e59b64;font:inherit;font-size:.72rem;cursor:pointer;text-decoration:underline;text-underline-offset:.2em;padding:.25rem}.popular-tags{display:flex;flex-wrap:wrap;gap:.4rem}.popular-tag{display:inline-flex;align-items:center;gap:.45rem;min-height:2.25rem;border:1px solid #3d3731;border-radius:.45rem;padding:.45rem .65rem;background:#201d1b;color:#b9afa7;font:inherit;font-size:.72rem;cursor:pointer;transition:border-color .15s,background .15s}.popular-tag:hover{border-color:#99643e;color:#f4c8a5}.popular-tag.selected{background:#3b291d;color:#ffab6c;border-color:#87502b}.popular-tag:focus-visible,.clear-tags:focus-visible,.tag-filter-error button:focus-visible{outline:2px solid #ed9857;outline-offset:2px}.tag-count{font-size:.65rem;font-variant-numeric:tabular-nums;opacity:.7}.tag-search-select{width:100%;min-width:0}.tag-filter-error{display:flex;align-items:center;gap:.5rem;color:#d6a28d;font-size:.72rem}.tag-filter-error button{flex-shrink:0}
</style>
