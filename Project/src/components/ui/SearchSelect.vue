<script setup lang="ts">
import { computed, ref } from 'vue';
import { NSelect, type SelectOption } from 'naive-ui';
import { searchTerm, useDebouncedValue } from '@/composables/useFilterDelay';

const props = defineProps<{ options: SelectOption[]; filter?: (query: string, option: SelectOption) => boolean }>();
const query = ref('');
const term = useDebouncedValue(() => searchTerm(query.value));
const visible = computed(() => {
  if (!term.value) return props.options;
  const text = term.value.toLocaleLowerCase('ru');
  return props.options.filter(option => props.filter ? props.filter(term.value, option) : String(option.label ?? '').toLocaleLowerCase('ru').includes(text));
});
</script>

<template>
  <NSelect filterable remote :options="visible" @search="query = $event" @update:show="open => { if (!open) query = '' }" @update:value="query = ''">
    <template v-if="$slots.empty" #empty><slot name="empty" /></template>
  </NSelect>
</template>
