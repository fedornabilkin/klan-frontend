<script setup lang="ts">
import SearchSelect from '@/components/ui/SearchSelect.vue';
import { computed } from 'vue';
import { normalizeTagQuery, type RankedTag } from '@/domain/tagPopularity';

const props = defineProps<{ tags: RankedTag[]; loading?: boolean }>();
const selected = defineModel<string[]>({ required: true });
const options = computed(() => props.tags.map(tag => ({
  value: tag.name, label: `${tag.name} · ${tag.count}`, search: normalizeTagQuery(tag.name),
})));
</script>

<template>
  <SearchSelect :value="selected" @update:value="selected = $event ?? []" class="tag-search-select" :options="options" :loading="loading"
    :filter="(pattern, option) => String(option.search).includes(normalizeTagQuery(pattern))"
    :fallback-option="false" multiple clearable max-tag-count="responsive"
    placeholder="Выбрать теги" aria-label="Поиск и выбор тегов">
    <template #empty>Подходящих тегов нет</template>
  </SearchSelect>
</template>
