<script setup lang="ts">
import { computed } from 'vue';
import { NSelect } from 'naive-ui';
import { normalizeTagQuery, type RankedTag } from '@/domain/tagPopularity';

const props = withDefaults(defineProps<{
  modelValue: string[];
  tags: RankedTag[];
  loading?: boolean;
  error?: string;
  limit?: number;
}>(), { limit: 8 });
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; retry: [] }>();
const popular = computed(() => props.tags.filter(tag => tag.count > 0).slice(0, props.limit));
const options = computed(() => props.tags.map(tag => ({ label: `${tag.name} · ${tag.count}`, value: tag.id })));
const names = computed(() => new Map(props.tags.map(tag => [tag.id, tag.name])));
function toggle(id: string) {
  emit('update:modelValue', props.modelValue.includes(id) ? props.modelValue.filter(value => value !== id) : [...props.modelValue, id]);
}
function filter(pattern: string, option: { value?: string | number; label?: unknown }): boolean {
  return normalizeTagQuery(names.value.get(String(option.value)) ?? String(option.label ?? '')).includes(normalizeTagQuery(pattern));
}
</script>

<template>
  <div class="community-tag-filter">
    <div class="tag-filter-heading">
      <span>Популярные теги</span>
      <button v-if="modelValue.length" type="button" class="clear-tags" @click="emit('update:modelValue', [])">Сбросить теги</button>
    </div>
    <div class="popular-tags" aria-label="Популярные теги сообщества">
      <button type="button" class="popular-tag" :class="{ selected: !modelValue.length }" :aria-pressed="!modelValue.length" @click="emit('update:modelValue', [])">Все участники</button>
      <button v-for="tag in popular" :key="tag.id" type="button" class="popular-tag" :class="{ selected: modelValue.includes(tag.id) }" :aria-pressed="modelValue.includes(tag.id)" :title="`${tag.name}: ${tag.count} участников`" @click="toggle(tag.id)">
        <span>{{ tag.name }}</span><span class="tag-count">{{ tag.count }}</span>
      </button>
    </div>
    <NSelect class="tag-search-select" :value="modelValue" :options="options" :loading="loading" :filter="filter" multiple filterable clearable :max-tag-count="3" placeholder="Найти тег в полном списке…" aria-label="Поиск и выбор тегов" @update:value="emit('update:modelValue', $event ?? [])">
      <template #empty>Подходящих тегов нет</template>
    </NSelect>
    <div v-if="error" class="tag-filter-error" role="status"><span>{{ error }}</span><button type="button" @click="emit('retry')">Повторить</button></div>
  </div>
</template>

<style scoped>
.community-tag-filter{display:grid;gap:.65rem;min-width:0}.tag-filter-heading{display:flex;justify-content:space-between;align-items:center;gap:.5rem;color:#a99e94;font-size:.7rem}.clear-tags,.tag-filter-error button{border:0;background:none;color:#e59b64;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:.2em;padding:.25rem}.popular-tags{display:flex;flex-wrap:wrap;gap:.4rem}.popular-tag{display:inline-flex;align-items:center;gap:.45rem;min-height:2.25rem;border:1px solid #3d3731;border-radius:.45rem;padding:.45rem .65rem;background:#201d1b;color:#b9afa7;font:inherit;font-size:.72rem;cursor:pointer;transition:border-color .15s,background .15s}.popular-tag:hover{border-color:#99643e;color:#f4c8a5}.popular-tag.selected{background:#3b291d;color:#ffab6c;border-color:#87502b}.popular-tag:focus-visible,.clear-tags:focus-visible,.tag-filter-error button:focus-visible{outline:2px solid #ed9857;outline-offset:2px}.tag-count{font-size:.65rem;font-variant-numeric:tabular-nums;opacity:.7}.tag-search-select{width:100%;min-width:0}.tag-filter-error{display:flex;align-items:center;gap:.5rem;color:#d6a28d;font-size:.72rem}.tag-filter-error button{flex-shrink:0}
</style>
