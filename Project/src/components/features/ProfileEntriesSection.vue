<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId, watch } from 'vue';
import { NButton } from 'naive-ui';
import type { ApiResponse, ProfileEntry, User } from '@shared/contracts';
import { isCalendarDate, normalizeProfileEntries } from '@shared/profile-entries';
import { api, errorMessage } from '@/services/api';
import Icon from '@/components/ui/Icon.vue';
import ProfileLinkedText from '@/components/ui/ProfileLinkedText.vue';

const props = defineProps<{ user: User; field: 'facts' | 'achievements'; title: string; icon?: string; editable: boolean }>();
const emit = defineEmits<{ saved: [user: User] }>();
const sectionId = useId();
const sectionElement = ref<HTMLElement | null>(null);
const mode = ref<'add' | 'edit' | null>(null);
const draftId = ref('');
const draft = reactive({ text: '', date: '' });
const original = ref<{ text: string; date: string | null } | null>(null);
const deleteId = ref<string | null>(null);
const busy = ref(false);
const error = ref('');
const announcement = ref('');
const entries = computed(() => normalizeProfileEntries(props.user[props.field], `${props.user.id}:${props.field}`));
const editedEntry = computed(() => mode.value === 'edit' ? entries.value.find(entry => entry.id === draftId.value) : undefined);
const removedWhileEditing = computed(() => mode.value === 'edit' && !editedEntry.value);
const changedWhileEditing = computed(() => !!editedEntry.value && !!original.value && (
  editedEntry.value.text !== original.value.text || editedEntry.value.date !== original.value.date
));
const displayedEntries = computed<ProfileEntry[]>(() => {
  if (mode.value && !entries.value.some(entry => entry.id === draftId.value)) {
    return [...entries.value, { id: draftId.value, text: draft.text, date: draft.date || null }];
  }
  return entries.value;
});
const entryLabel = computed(() => props.field === 'facts' ? 'факт' : 'достижение');
const addLabel = computed(() => props.field === 'facts' ? 'Добавить факт' : 'Добавить достижение');

function reset() {
  mode.value = null;
  draftId.value = '';
  draft.text = '';
  draft.date = '';
  original.value = null;
  deleteId.value = null;
  error.value = '';
}
// A refreshed User object must not replace the draft being typed.
watch([() => props.user.id, () => props.field], () => { reset(); announcement.value = ''; });
function cancel() {
  if (busy.value) return;
  reset();
  nextTick(() => sectionElement.value?.querySelector<HTMLButtonElement>('.entry-add')?.focus());
}
async function start(entry?: ProfileEntry) {
  if (busy.value || mode.value || !props.editable) return;
  error.value = '';
  announcement.value = '';
  deleteId.value = null;
  if (!entry && entries.value.length >= 100) { error.value = 'В этом разделе можно сохранить не более 100 записей.'; return; }
  draftId.value = entry?.id || crypto.randomUUID();
  draft.text = entry?.text || '';
  draft.date = entry?.date || '';
  original.value = entry ? { text: entry.text, date: entry.date } : null;
  mode.value = entry ? 'edit' : 'add';
  await nextTick();
  sectionElement.value?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
}
function askDelete(id: string) {
  if (busy.value || mode.value || !props.editable) return;
  error.value = '';
  announcement.value = '';
  deleteId.value = id;
}
function validDate(value: string) {
  return !value || isCalendarDate(value);
}
function dateLabel(value: string) {
  if (!validDate(value)) return value;
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
async function persist(nextEntries: ProfileEntry[], message: string) {
  const userId = props.user.id;
  const field = props.field;
  busy.value = true;
  error.value = '';
  try {
    const result = await api.patch<ApiResponse<User>>(`/users/${encodeURIComponent(userId)}`, { [field]: nextEntries });
    if (props.user.id === userId && props.field === field) {
      reset();
      announcement.value = message;
      emit('saved', result.data);
      await nextTick();
      sectionElement.value?.querySelector<HTMLButtonElement>('.entry-add')?.focus();
    }
  } catch (cause) {
    if (props.user.id === userId && props.field === field) error.value = errorMessage(cause);
  } finally { busy.value = false; }
}
async function save() {
  if (busy.value || !mode.value) return;
  error.value = '';
  if (!props.editable) { error.value = 'Редактирование профиля недоступно.'; return; }
  const text = draft.text;
  if (!text.trim() || text.length > 1000) { error.value = 'Введите текст от 1 до 1000 символов.'; return; }
  if (!validDate(draft.date)) { error.value = 'Укажите существующую дату в формате ГГГГ-ММ-ДД или оставьте поле пустым.'; return; }
  // Re-read current props at submission, preserving realtime updates to other rows.
  const latest = normalizeProfileEntries(props.user[props.field], `${props.user.id}:${props.field}`);
  const updated: ProfileEntry = { id: draftId.value, text, date: draft.date || null };
  if (mode.value === 'edit') {
    if (!latest.some(entry => entry.id === draftId.value)) {
      error.value = 'Эта запись уже удалена. Черновик сохранён в форме; отмените редактирование, чтобы продолжить.';
      return;
    }
    await persist(latest.map(entry => entry.id === draftId.value ? updated : entry), 'Запись обновлена.');
  } else {
    if (latest.length >= 100) { error.value = 'Достигнут предел: 100 записей в разделе. Сначала удалите одну из записей.'; return; }
    await persist([...latest, updated], 'Запись добавлена.');
  }
}
async function remove() {
  if (busy.value || !deleteId.value) return;
  error.value = '';
  if (!props.editable) { error.value = 'Редактирование профиля недоступно.'; return; }
  const latest = normalizeProfileEntries(props.user[props.field], `${props.user.id}:${props.field}`);
  if (!latest.some(entry => entry.id === deleteId.value)) {
    deleteId.value = null;
    error.value = 'Эта запись уже удалена. Список обновлён.';
    return;
  }
  await persist(latest.filter(entry => entry.id !== deleteId.value), 'Запись удалена.');
}
</script>

<template>
  <section ref="sectionElement" class="profile-entries" :aria-labelledby="`${sectionId}-heading`" :aria-busy="busy">
    <header class="entries-heading">
      <h2 :id="`${sectionId}-heading`"><Icon v-if="icon" :name="icon" />{{ title }}</h2>
      <NButton v-if="editable" class="entry-add" size="small" secondary :disabled="busy || !!mode || entries.length >= 100" :aria-label="addLabel" @click="start()">
        <template #icon><Icon name="plus" /></template>
        Добавить
      </NButton>
    </header>
    <p v-if="!displayedEntries.length" class="entries-empty">{{ editable ? (field === 'facts' ? 'Добавьте первый факт. Дату можно не указывать.' : 'Добавьте первое достижение. Дату можно не указывать.') : 'Записей пока нет.' }}</p>
    <ul v-else class="entries-list">
      <li v-for="(entry, index) in displayedEntries" :key="entry.id" class="entry-row" :class="{ 'entry-row-editing': mode && draftId === entry.id }">
        <form v-if="mode && draftId === entry.id" class="entry-form" @submit.prevent="save">
          <p class="form-heading">{{ mode === 'add' ? addLabel : `Изменить ${entryLabel}` }}</p>
          <p v-if="removedWhileEditing" class="entry-warning" role="alert">Запись удалена в другом сеансе. Ваш черновик сохранён здесь, но эту запись уже нельзя изменить.</p>
          <p v-else-if="changedWhileEditing" class="entry-warning" role="status">Запись обновилась в другом сеансе. Ваш черновик сохранён; при сохранении он заменит текст и дату этой записи.</p>
          <p v-if="!editable" class="entry-warning" role="alert">Редактирование профиля недоступно.</p>
          <label :for="`${sectionId}-text`">Текст</label>
          <textarea :id="`${sectionId}-text`" v-model="draft.text" rows="3" maxlength="1000" required :disabled="busy || !editable" :aria-describedby="`${sectionId}-text-hint`" />
          <span :id="`${sectionId}-text-hint`" class="entry-hint">{{ draft.text.length }} / 1000</span>
          <div class="entry-date-row">
            <label :for="`${sectionId}-date`">Дата <span class="entry-hint">· необязательно</span></label>
            <div class="entry-date-controls">
              <input :id="`${sectionId}-date`" v-model="draft.date" type="date" min="0001-01-01" max="9999-12-31" :disabled="busy || !editable" :aria-describedby="`${sectionId}-date-hint`" />
              <NButton v-if="draft.date" size="small" quaternary :disabled="busy || !editable" aria-label="Убрать дату записи" @click="draft.date = ''">Убрать дату</NButton>
            </div>
            <p :id="`${sectionId}-date-hint`" class="entry-hint">Оставьте поле пустым, если дата неизвестна.</p>
          </div>
          <div class="entry-form-actions">
            <NButton size="small" :disabled="busy" @click="cancel">Отмена</NButton>
            <NButton size="small" type="primary" attr-type="submit" :loading="busy" :disabled="!editable || removedWhileEditing">Сохранить</NButton>
          </div>
        </form>
        <template v-else>
          <div class="entry-content">
            <p><ProfileLinkedText :text="entry.text" :telegram-username="user.username" /></p>
            <time v-if="entry.date" :datetime="entry.date">{{ dateLabel(entry.date) }}</time>
          </div>
          <div v-if="editable && deleteId !== entry.id" class="entry-actions">
            <NButton size="small" quaternary circle :disabled="busy || !!mode" :aria-label="`Изменить ${entryLabel} ${index + 1}`" data-tooltip="Изменить" @click="start(entry)"><template #icon><Icon name="pen" /></template></NButton>
            <NButton size="small" quaternary circle :disabled="busy || !!mode" :aria-label="`Удалить ${entryLabel} ${index + 1}`" data-tooltip="Удалить" @click="askDelete(entry.id)"><template #icon><Icon name="trash" /></template></NButton>
          </div>
          <div v-if="deleteId === entry.id" class="entry-delete" role="group" :aria-label="`Подтверждение удаления: ${entryLabel} ${index + 1}`">
            <p>Удалить {{ entryLabel }}?</p>
            <div>
              <NButton size="small" :disabled="busy" @click="deleteId = null; error = ''">Отмена</NButton>
              <NButton size="small" type="error" secondary :loading="busy" :disabled="!editable" @click="remove">Удалить</NButton>
            </div>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="editable && entries.length >= 100" class="entry-hint limit-note">Достигнут предел: 100 записей в разделе.</p>
    <p v-if="error" class="entries-error" role="alert">{{ error }}</p>
    <p class="entry-announcement" role="status" aria-live="polite">{{ announcement }}</p>
  </section>
</template>

<style scoped>
.entry-actions :deep(.n-button){min-width:2.75rem;min-height:2.75rem}.entry-form-actions :deep(.n-button),.entry-delete :deep(.n-button),.entry-add{min-height:2.75rem}
.profile-entries{min-width:0}.entries-heading{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:.6rem}.entries-heading h2{display:flex;align-items:center;gap:.55rem;margin:0;font-size:1rem;line-height:1.5;min-width:0;overflow-wrap:anywhere}.entries-heading h2 :deep(.ui-icon){color:#da9b6b}.entry-add{flex-shrink:0}.entries-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:minmax(0,1fr)}.entry-row{display:flex;gap:.5rem;align-items:flex-start;flex-wrap:wrap;padding:.8rem 0;border-bottom:1px solid #ffffff0c;min-width:0}.entry-row:last-child{border-bottom:0}.entry-content{min-width:0;flex:1 1 12rem}.entry-content p{font-size:.82rem;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.entry-content time{display:block;font-size:.69rem;color:#a39a91;margin-top:.35rem}.entry-actions{display:flex;gap:.1rem;margin-left:auto}.entries-empty,.entry-hint{color:#a49c94;font-size:.72rem;line-height:1.6}.entries-empty{margin:.7rem 0 0}.entry-form{display:grid;width:100%;min-width:0;gap:.4rem;padding:.85rem;background:#ffffff04;border:1px solid #ffffff12;border-radius:.55rem}.entry-row-editing{border:0}.form-heading{margin:0 0 .35rem;font-size:.8rem;font-weight:600}.entry-form label{font-size:.73rem;color:#c4bbb1}.entry-form textarea,.entry-form input{box-sizing:border-box;width:100%;min-width:0;font:inherit;font-size:.8rem;line-height:1.55;color:inherit;background:#191b18;border:1px solid #ffffff26;border-radius:.4rem;padding:.55rem .65rem;color-scheme:dark}.entry-form textarea{resize:vertical;min-height:5.5rem}.entry-form textarea:focus-visible,.entry-form input:focus-visible{outline:2px solid #da8e55;outline-offset:2px}.entry-form textarea:disabled,.entry-form input:disabled{opacity:.6}.entry-form>.entry-hint{text-align:right}.entry-date-row{display:grid;gap:.35rem;margin-top:.4rem}.entry-date-row p{margin:0}.entry-date-controls{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.entry-date-controls input{flex:1 1 10rem;max-width:14rem;min-height:2.3rem}.entry-form-actions{display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}.entry-delete{width:100%;display:flex;justify-content:space-between;align-items:center;gap:.65rem;flex-wrap:wrap;background:#9e544018;border:1px solid #b9796133;border-radius:.4rem;padding:.6rem .75rem}.entry-delete p{font-size:.75rem;margin:0}.entry-delete>div{display:flex;gap:.4rem;margin-left:auto}.entry-warning{color:#e5b877;background:#80603317;border-left:2px solid #bc8745;padding:.55rem .65rem;font-size:.74rem;line-height:1.6;margin:.1rem 0 .5rem;overflow-wrap:anywhere}.entries-error{color:#f0a49d;font-size:.76rem;line-height:1.6;margin:.65rem 0 0;overflow-wrap:anywhere}.limit-note{margin:.7rem 0 0}.entry-announcement{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:28rem){.entries-heading{flex-wrap:wrap}.entries-heading h2{flex:1 1 10rem}.entry-content{flex-basis:calc(100% - 4.5rem)}.entry-form{padding:.7rem}.entry-date-controls input{max-width:100%}}
</style>
