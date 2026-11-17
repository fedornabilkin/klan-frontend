<script setup lang="ts">
import { ref, watch } from 'vue';
import { NAlert, NButton, NModal } from 'naive-ui';
import type { CatalogKind } from '@shared/catalog';
import type { CatalogEntryModel } from '@/domain/catalog';
import { catalogService } from '@/services/catalog';
import { errorMessage } from '@/services/api';

const props = defineProps<{ show: boolean; kind: CatalogKind; entry: CatalogEntryModel }>();
const emit = defineEmits<{ 'update:show': [value: boolean]; deleted: [] }>();
const busy = ref(false);
const error = ref('');
watch(() => props.show, () => { error.value = ''; });
async function remove(): Promise<void> {
  if (busy.value || !props.entry.canDelete) return;
  busy.value = true; error.value = '';
  try { await catalogService.remove(props.kind, props.entry.id); emit('deleted'); emit('update:show', false); }
  catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template lang="pug">
NModal(:show="show" preset="card" title="Удалить запись справочника?" :style="{ width: 'min(30rem, calc(100vw - 2rem))' }" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="emit('update:show', $event)")
  p Запись «{{ entry.name }}» будет удалена. Это действие нельзя отменить.
  p.catalog-help Удалить можно только неиспользуемую запись. Если кто-то успел добавить её в профиль или материал, сервер сохранит связи и отменит удаление.
  NAlert(v-if="error" type="error" role="alert") {{ error }}
  .catalog-modal-actions
    NButton(:disabled="busy" @click="emit('update:show', false)") Отмена
    NButton(type="error" :loading="busy" :disabled="!entry.canDelete" @click="remove") Удалить запись
</template>

<style scoped>
.catalog-help { color: #a6aea0; font-size: .8rem; line-height: 1.7; }
.catalog-modal-actions { display: flex; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; margin-top: 1.5rem; }
</style>
