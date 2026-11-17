<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NForm, NFormItem, NInput, NModal } from 'naive-ui';
import type { CatalogKind } from '@shared/catalog';
import type { CatalogEntryModel } from '@/domain/catalog';
import { catalogService } from '@/services/catalog';
import { errorMessage } from '@/services/api';

const props = defineProps<{ show: boolean; kind: CatalogKind; entry: CatalogEntryModel | null }>();
const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>();
const name = ref('');
const error = ref('');
const busy = ref(false);
const title = computed(() => props.entry ? 'Переименовать запись' : props.kind === 'tags' ? 'Новый тег' : 'Новый предмет');
watch(() => props.show, show => { if (show) { name.value = props.entry?.name ?? ''; error.value = ''; } });
async function save(): Promise<void> {
  if (busy.value) return;
  const value = name.value.trim().replace(/\s+/g, ' ');
  if (!value || value.length > 80) { error.value = 'Введите название от 1 до 80 символов.'; return; }
  error.value = ''; busy.value = true;
  try {
    if (props.entry) await catalogService.rename(props.kind, props.entry.id, value);
    else await catalogService.create(props.kind, value);
    emit('saved'); emit('update:show', false);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template lang="pug">
NModal(:show="show" preset="card" :title="title" class="feature-modal" :style="{ width: 'min(32rem, calc(100vw - 2rem))' }" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="emit('update:show', $event)")
  p.catalog-help(v-if="entry") Новое название появится во всех связанных профилях и материалах. Существующие связи сохранятся.
  NForm(label-placement="top" @submit.prevent="save")
    NFormItem(label="Название")
      NInput(v-model:value="name" placeholder="Название записи" aria-label="Название записи справочника" :disabled="busy" :maxlength="80" show-count)
    NAlert(v-if="error" type="error" role="alert") {{ error }}
    .catalog-modal-actions
      NButton(:disabled="busy" @click="emit('update:show', false)") Отмена
      NButton(type="primary" attr-type="submit" :loading="busy") {{ entry ? 'Сохранить название' : 'Создать' }}
</template>

<style scoped>
.catalog-help { color: #a6aea0; font-size: .85rem; line-height: 1.7; margin: 0 0 1.25rem; }
.catalog-modal-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .75rem; margin-top: 1.5rem; }
</style>
