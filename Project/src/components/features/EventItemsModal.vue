<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NModal } from 'naive-ui';
import type { ApiResponse, Entity, Item } from '@shared/contracts';
import { normalizeTagName } from '@shared/tag-names';
import { searchTerm, useDebouncedValue } from '@/composables/useFilterDelay';
import { api, errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import NumberField from '@/components/ui/NumberField.vue';
import Icon from '@/components/ui/Icon.vue';

type PickedItem = { id?: string; name: string; quantity?: number | null };
const props = defineProps<{ show: boolean; entity: Entity }>();
const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>();
const auth = useAuthStore();
const catalog = ref<Item[]>([]), selected = ref<PickedItem[]>([]);
const query = ref(''), comment = ref(''), error = ref(''), busy = ref(false), loading = ref(false);
const reload = ref(0), catalogError = ref('');
const key = (name: string) => normalizeTagName(name).toLocaleLowerCase('ru');
const term = useDebouncedValue(() => key(searchTerm(query.value)));
const typed = computed(() => normalizeTagName(query.value));
const chosen = computed(() => new Set(selected.value.map(item => key(item.name))));
const available = computed(() => catalog.value.filter(item => !chosen.value.has(key(item.name)) && key(item.name).includes(term.value)));
const canCreate = computed(() => typed.value && !loading.value && !catalogError.value && !chosen.value.has(key(typed.value))
  && !catalog.value.some(item => key(item.name) === key(typed.value)));

watch([() => props.show, () => props.entity.id], ([shown]) => {
  if (!shown) return;
  const participant = props.entity.participants.find(row => row.user.id === auth.user?.id);
  selected.value = (participant?.items ?? []).map(item => ({ ...item, quantity: item.quantity ?? 1 }));
  comment.value = participant?.comment ?? '';
  query.value = error.value = '';
}, { immediate: true });
watch([() => props.show, reload], async ([shown], _, cleanup) => {
  if (!shown) return;
  const request = new AbortController();
  cleanup(() => request.abort());
  catalog.value = []; catalogError.value = ''; loading.value = true;
  try {
    const { data } = await api.get<ApiResponse<Item[]>>('/items', undefined, request.signal);
    if (!request.signal.aborted) catalog.value = data;
  } catch (cause) { if (!request.signal.aborted) catalogError.value = errorMessage(cause); }
  finally { if (!request.signal.aborted) loading.value = false; }
}, { immediate: true });
function add(item: Pick<PickedItem, 'id' | 'name'>) {
  if (busy.value || chosen.value.has(key(item.name))) return;
  if (selected.value.length >= 50) { error.value = 'Можно выбрать до 50 предметов.'; return; }
  selected.value.push({ ...item, quantity: 1 });
  query.value = error.value = '';
}
async function save() {
  if (busy.value) return;
  if (selected.value.some(item => !Number.isInteger(item.quantity) || (item.quantity ?? 0) < 1 || (item.quantity ?? 0) > 999)) {
    error.value = 'Укажите для каждого предмета целое количество от 1 до 999.'; return;
  }
  const eventId = props.entity.id;
  busy.value = true; error.value = '';
  try {
    await api.put('/events/' + encodeURIComponent(eventId) + '/items', { items: selected.value, comment: comment.value.trim() });
    if (props.entity.id === eventId) { emit('saved'); emit('update:show', false); }
  } catch (cause) { if (props.entity.id === eventId) error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template>
  <NModal :show="show" preset="card" title="Что я возьму с собой" class="event-items-modal"
    :style="{ width: 'min(36rem, calc(100vw - 2rem))' }" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="emit('update:show', $event)">
    <form class="equipment-form" @submit.prevent="save">
      <label class="field">Поиск предмета
        <input v-model="query" type="search" maxlength="80" placeholder="Название предмета (поиск от 3 символов)" :disabled="busy" @keydown.enter.prevent />
      </label>
      <div v-if="selected.length" class="picked-items" role="group" aria-label="Выбранные предметы">
        <div v-for="(item, index) in selected" :key="item.id ?? item.name" class="picked-chip">
          <strong>{{ item.name }}</strong><span aria-hidden="true">×</span>
          <NumberField v-model="item.quantity" min="1" max="999" required :aria-label="'Количество: ' + item.name" :disabled="busy" />
          <button type="button" class="remove-item" :aria-label="'Убрать ' + item.name" :data-tooltip="'Убрать ' + item.name" :disabled="busy" @click="selected.splice(index, 1)"><Icon name="xmark" /></button>
        </div>
      </div>
      <div class="item-options" role="group" aria-label="Справочник предметов">
        <button v-for="item in available" :key="item.id" class="item-chip" type="button" :disabled="busy" @click="add(item)">{{ item.name }}</button>
        <button v-if="canCreate" class="item-chip create-item" type="button" :disabled="busy" @click="add({ name: typed })"><Icon name="plus" /> Создать «{{ typed }}»</button>
        <span v-if="!catalog.length && !loading && !catalogError && !typed" role="status">Справочник пока пуст. Введите название первого предмета.</span>
        <span v-if="loading" role="status">Загрузка предметов…</span>
        <span v-if="catalogError" role="alert">{{ catalogError }} <button type="button" @click="reload++">Повторить</button></span>
      </div>
      <label class="field">Комментарий к участию
        <small>Комментарий увидят в списке участников мероприятия.</small>
        <textarea v-model="comment" rows="3" maxlength="1000" placeholder="Например, приду к началу второй части" :disabled="busy" />
      </label>
      <p v-if="error" class="modal-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><NButton :disabled="busy" @click="emit('update:show', false)">Отмена</NButton><NButton type="primary" attr-type="submit" :loading="busy">Сохранить</NButton></div>
    </form>
  </NModal>
</template>

<style scoped>
.equipment-form,.field{display:grid;gap:.75rem;min-width:0}.field{gap:.35rem;font-size:.84rem}
.field input,.field textarea{box-sizing:border-box;min-width:0;width:100%;padding:.65rem .75rem;background:var(--surface-raised);color:var(--text);border:1px solid var(--border);border-radius:.5rem;font:inherit}.field textarea{resize:vertical}.field small{color:var(--muted);font-size:.75rem}
.picked-items,.item-options{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem}
.item-options{max-height:12rem;overflow:auto}.item-options span{font-size:.8rem;color:var(--muted)}
.item-chip,.picked-chip{display:inline-flex;align-items:center;gap:.4rem;max-width:100%;padding:.36rem .6rem;border:1px solid var(--border);border-radius:.65rem;color:var(--text);background:var(--surface-raised);font:inherit;font-size:.83rem;overflow-wrap:anywhere}
.item-chip{cursor:pointer;min-height:2rem}.item-chip:hover,.create-item{border-color:#9c6846;color:#ffb17c}
.picked-chip{box-sizing:border-box;background:#37291f;border-color:#93603e;color:#ffd3ad;padding:.2rem .3rem .2rem .65rem}.picked-chip strong{font-weight:600;min-width:0}.picked-chip :deep(.number-field){box-sizing:border-box;width:3.45rem;padding:.24rem .3rem;font-size:.8rem}.remove-item{padding:.25rem;background:transparent;color:inherit;border:0;cursor:pointer;min-width:1.8rem;min-height:1.8rem}
.equipment-form :focus-visible{outline:2px solid var(--accent);outline-offset:2px}.modal-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.3rem}.modal-error{font-size:.8rem;color:#f2a19b}
</style>
