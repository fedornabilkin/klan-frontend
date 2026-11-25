<script setup lang="ts">
import EventOrganizerField from './EventOrganizerField.vue';
import CountryCityEditor from './CountryCityEditor.vue'
import { changedTelegramUsername } from '@/domain/profile-identity'
import FeedbackStatusButtons from './FeedbackStatusButtons.vue'
import SearchSelect from '@/components/ui/SearchSelect.vue';
import { computed, ref, watch } from 'vue'
import { NModal, NInput, NSelect, NButton, NAlert, NFormItem } from 'naive-ui'
import type { ApiResponse, Entity, Location, ProfileEntry, Resource, Tag, User } from '@shared/contracts'
import { latestProfileDate, normalizeTelegramUsername } from '@shared/profile-identity'
import { isCalendarDate, normalizeProfileEntries } from '@shared/profile-entries'
import NumberField from '@/components/ui/NumberField.vue'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ show: boolean; resource: Resource; entity?: Entity | User | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [record: Entity | User] }>()
const auth = useAuthStore()
const busy = ref(false)
const error = ref('')
const tags = ref<Tag[]>([])
const form = ref({ title: '', bookAuthor: '', description: '', clanJoinedOn: '', content: '', status: 'active', category: '', callsign: '', username: '', usernameChangeComment: '', location: { city: '', country: '', lat: null, lng: null } as Location, start: '', end: '', motto: '', target: 100 as number | null, unit: 'раз', capacity: null as number | null, organizer: null as Entity['organizer'], tagIds: [] as string[], facts: [] as ProfileEntry[], achievements: [] as ProfileEntry[] })
const entrySections = [{ field: 'facts', label: 'Факты', addLabel: 'Добавить факт' }, { field: 'achievements', label: 'Достижения', addLabel: 'Добавить достижение' }] as const
type EntryField = typeof entrySections[number]['field']
const isUser = computed(() => props.resource === 'users')
const canSetStatus = computed(() => props.resource === 'feedback' ? auth.isAdmin : auth.can('content.manage'))
const initialStatus = ref<string>()
const profile = computed(() => props.entity && 'name' in props.entity ? props.entity : undefined)
const usernameChanged = computed(() => normalizeTelegramUsername(form.value.username) !== normalizeTelegramUsername(profile.value?.username ?? ''))
const coordinatesLocked = ref(false)
function selectProfileLocation(location: Location) {
  form.value.location = location
  coordinatesLocked.value = location.lat != null && location.lng != null
}
const hasDates = computed(() => ['events', 'challenges'].includes(props.resource))
const savedGoal = computed(() => props.entity && 'goal' in props.entity ? props.entity : undefined)
const originalFraction = computed(() => savedGoal.value?.category === form.value.category && savedGoal.value.goal?.target === form.value.target && !Number.isInteger(form.value.target))
const hasLocation = computed(() => ['users', 'events'].includes(props.resource))
const tagOptions = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.id })))
const statusOptions = computed(() => (props.resource === 'teams'
    ? [{ label: 'Активна', value: 'active' }, { label: 'Архив', value: 'archived' }]
    : ['events', 'challenges'].includes(props.resource)
      ? [{ label: 'Скоро', value: 'upcoming' }, { label: 'Активно', value: 'active' }, { label: 'Завершено', value: 'completed' }, { label: 'Архив', value: 'archived' }]
      : [{ label: 'Опубликовано', value: 'published' }, { label: 'Активно', value: 'active' }, { label: 'Черновик', value: 'draft' }, { label: 'Архив', value: 'archived' }]))
const categoryOptions = computed(() => props.resource === 'events'
  ? [{ label: 'Оффлайн', value: 'offline' }, { label: 'Онлайн', value: 'online' }]
  : props.resource === 'challenges'
    ? [{ label: 'Количество', value: 'count' }, { label: 'Упражнения', value: 'sport' }, { label: 'Дистанция', value: 'distance' }, { label: 'Факт посещения', value: 'attendance' }]
  : props.resource === 'rules'
    ? [{ label: 'Основные', value: 'general' }, { label: 'Оффлайн', value: 'offline' }, { label: 'Онлайн', value: 'online' }, { label: 'Рекомендации', value: 'recommendations' }]
    : [])
function changeCategory(value: unknown) {
  if (typeof value !== 'string') return
  const previous = form.value.category
  form.value.category = value
  if (props.resource !== 'challenges') return
  if (value === 'attendance') form.value.unit = 'посещений'
  else if (value === 'distance') form.value.unit = 'км'
  else if (value === 'sport') form.value.unit = 'повторений'
  else if (previous === 'attendance' || previous === 'distance') form.value.unit = 'раз'
}
function localDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
watch(() => props.show, async show => {
  if (!show) return
  error.value = ''
  const entity = props.entity
  const item = entity && 'title' in entity ? entity : undefined
  initialStatus.value = item?.status
  const user = entity && 'name' in entity ? entity : undefined
  coordinatesLocked.value = !!user?.location.city && user.location.lat != null && user.location.lng != null
  form.value = {
    title: item?.title ?? user?.name ?? '', description: item?.description ?? user?.bio ?? '', content: item?.content ?? '', bookAuthor: item?.bookAuthor ?? '',
    status: item?.status ?? ({feedback:'open', books:'published'} as Partial<Record<Resource,string>>)[props.resource] ?? 'active', category: item?.category ?? ({ events: 'offline', challenges: 'count', rules: 'general' } as Partial<Record<Resource, string>>)[props.resource] ?? '',
    clanJoinedOn: user?.clanJoinedOn ?? '',
    location: { city: entity?.location?.city ?? '', country: entity?.location?.country ?? '', lat: entity?.location?.lat ?? null, lng: entity?.location?.lng ?? null },
    callsign: user?.callsign ?? '', username: user?.username ?? '', usernameChangeComment: '',
    start: localDate(item?.schedule?.start), end: localDate(item?.schedule?.end), motto: item?.motto ?? '', target: item?.goal?.target ?? 100,
    unit: item?.goal?.unit ?? 'раз', capacity: item?.capacity ?? null, organizer: item?.organizer ?? null, tagIds: entity?.tags.map(tag => tag.id) ?? [],
    facts: normalizeProfileEntries(user?.facts, `${user?.id}:facts`),
    achievements: normalizeProfileEntries(user?.achievements, `${user?.id}:achievements`),
  }
  try { tags.value = (await api.get<ApiResponse<Tag[]>>('/tags')).data } catch { tags.value = entity?.tags ?? [] }
}, { immediate: true })
function addEntry(field: EntryField) {
  if (busy.value || form.value[field].length >= 100) return
  form.value[field].push({ id: crypto.randomUUID(), text: '', date: null })
}
function removeEntry(field: EntryField, id: string) {
  if (!busy.value) form.value[field] = form.value[field].filter(entry => entry.id !== id)
}
function updateEntryDate(entry: ProfileEntry, event: Event) {
  entry.date = (event.target as HTMLInputElement).value || null
}
async function save() {
  if (busy.value) return
  error.value = ''
  if (isUser.value && !props.entity) { error.value = 'Профили создаются при первом входе через Telegram.'; return }
  if (!form.value.title.trim()) { error.value = 'Укажите название или имя.'; return }
  const f = form.value
  let username: string | null | undefined
  if (isUser.value) {
    try { username = changedTelegramUsername(f.username, profile.value?.username ?? '') }
    catch (cause) { error.value = (cause as Error).message; return }
    if (username !== undefined && !f.usernameChangeComment.trim()) {
      error.value = 'Укажите причину изменения логина Telegram.'; return
    }
    for (const section of entrySections) {
      if (f[section.field].length > 100) { error.value = `${section.label}: можно сохранить не более 100 записей.`; return }
      for (const entry of f[section.field]) {
        if (!entry.text.trim() || entry.text.length > 1000) { error.value = `${section.label}: заполните текст каждой записи, не более 1000 символов.`; return }
        if (entry.date !== null && !isCalendarDate(entry.date)) { error.value = `${section.label}: укажите корректную дату или оставьте её пустой.`; return }
      }
    }
  }
  if (hasDates.value && (!Number.isFinite(Date.parse(f.start)) || !Number.isFinite(Date.parse(f.end)) || Date.parse(f.end) <= Date.parse(f.start))) {
    error.value = 'Укажите период: окончание должно быть позже начала.'; return
  }
  if (hasLocation.value && !(f.location.lat === null && f.location.lng === null) && (typeof f.location.lat !== 'number' || !Number.isFinite(f.location.lat) || f.location.lat < -90 || f.location.lat > 90 || typeof f.location.lng !== 'number' || !Number.isFinite(f.location.lng) || f.location.lng < -180 || f.location.lng > 180)) {
    error.value = 'Укажите обе координаты: широта от −90 до 90, долгота от −180 до 180, или оставьте обе пустыми.'; return
  }
  if (props.resource === 'events' && f.capacity != null && (typeof f.capacity !== 'number' || !Number.isInteger(f.capacity) || f.capacity < 1 || f.capacity > 100000)) {
    error.value = 'Укажите количество мест: целое число от 1 до 100 000.'; return
  }
  if (props.resource === 'challenges' && (typeof f.target !== 'number' || !Number.isFinite(f.target) || f.target <= 0 || f.target > 1e9 || !f.unit.trim())) {
    error.value = 'Укажите положительную числовую цель и единицу измерения.'; return
  }
  if (props.resource === 'challenges' && f.category !== 'distance' && !originalFraction.value && !Number.isInteger(f.target)) {
    error.value = 'Укажите целое число для цели.'; return
  }
  const location = { city: f.location.city.trim(), country: f.location.country.trim(), lat: f.location.lat, lng: f.location.lng }
  const selectedTags = tags.value.filter(tag => f.tagIds.includes(tag.id))
  const payload = isUser.value
    ? { name: f.title.trim(), bio: f.description, location, tags: selectedTags,
        ...(f.callsign.trim() !== (profile.value?.callsign ?? '') && { callsign: f.callsign.trim() }),
        ...(username !== undefined && { username, usernameChangeComment: f.usernameChangeComment.trim() }),
        ...(props.entity && 'name' in props.entity && f.clanJoinedOn !== (props.entity.clanJoinedOn ?? '') && { clanJoinedOn:f.clanJoinedOn || null }),
        facts: f.facts.map(entry => ({ ...entry })), achievements: f.achievements.map(entry => ({ ...entry })) }
    : {
        title: f.title.trim(), description: f.description, ...(props.resource === 'books' ? {bookAuthor:f.bookAuthor.trim()} : {content:f.content}), ...(canSetStatus.value && f.status !== initialStatus.value ? { status: f.status } : {}), category: f.category, tags: selectedTags,
      ...(hasDates.value ? { schedule: { start: new Date(f.start).toISOString(), end: new Date(f.end).toISOString() } } : {}),
      ...(hasLocation.value ? { location } : {}),
      ...(props.resource === 'teams' ? { motto: f.motto } : {}),
      ...(props.resource === 'challenges' ? { goal: { target: f.target, unit: f.unit.trim(), scope: 'participant' } } : {}),
      ...(props.resource === 'events' ? { capacity: f.capacity ?? null, organizer: f.organizer ?? null } : {}),
    }
  busy.value = true
  try {
    const result = props.entity
      ? await api.patch<ApiResponse<Entity | User>>(`/${isUser.value ? 'admin/users' : props.resource}/${encodeURIComponent(props.entity.id)}`, payload)
      : await api.post<ApiResponse<Entity | User>>(`/${props.resource}`, payload)
    if (isUser.value && props.entity?.id === auth.user?.id) await auth.restore(true)
    emit('saved', result.data); emit('update:show', false)
  } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось сохранить запись.' }
  finally { busy.value = false }
}
</script>

<template lang="pug">
NModal(:show="show" preset="card" :title="entity ? 'Редактировать запись' : resource === 'books' ? 'Добавить книгу' : 'Новая запись'" class="entity-editor-modal" :style="{ width: 'min(42rem, calc(100vw - 2rem))' }" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="emit('update:show', $event)")
  form.editor-form(@submit.prevent="save")
    NAlert(v-if="error" type="error" :show-icon="false") {{ error }}
    NFormItem(:label="isUser ? 'Имя и фамилия' : 'Название'" required)
      NInput(v-model:value="form.title" :maxlength="120" autofocus)
    NFormItem(v-if="resource === 'books'" label="Автор книги")
      NInput(v-model:value="form.bookAuthor" :maxlength="200" :input-props="{ 'aria-label':'Автор книги' }")
    template(v-if="isUser")
      .editor-columns
        NFormItem(label="Позывной")
          NInput(v-model:value="form.callsign" :maxlength="120" :disabled="busy" aria-label="Позывной")
        NFormItem(label="Логин Telegram")
          NInput(v-model:value="form.username" :disabled="busy" placeholder="@username" aria-label="Логин Telegram")
      NFormItem(v-if="usernameChanged" label="Причина изменения логина Telegram" required)
        NInput(v-model:value="form.usernameChangeComment" type="textarea" :rows="2" :maxlength="1000" :disabled="busy" aria-label="Причина изменения логина Telegram" :input-props="{ required: true }")
    NFormItem(:label="isUser ? 'О себе' : 'Краткое описание'")
      NInput(v-model:value="form.description" type="textarea" :rows="3" :maxlength="5000")
    template(v-if="!isUser")
      .editor-columns
        NFormItem(v-if="canSetStatus" label="Статус")
          FeedbackStatusButtons(v-if="resource === 'feedback'" :status="form.status" :busy="busy" show-current @select="form.status = $event")
          NSelect(v-else v-model:value="form.status" :options="statusOptions")
        NFormItem(label="Категория")
          NSelect(v-if="categoryOptions.length" :value="form.category" :options="categoryOptions" @update:value="changeCategory")
          NInput(v-else v-model:value="form.category" placeholder="Например, развитие")
      NFormItem(v-if="resource !== 'books'" label="Подробный текст")
        NInput(v-model:value="form.content" type="textarea" :rows="5" :maxlength="20000")
    NFormItem(label="Теги")
      SearchSelect(v-model:value="form.tagIds" :options="tagOptions" multiple placeholder="Выберите теги сообщества")
    template(v-if="hasLocation")
      CountryCityEditor(v-if="isUser && show" :model-value="form.location" :disabled="busy" @update:model-value="selectProfileLocation")
      .editor-columns(v-if="!isUser")
        NFormItem(label="Город")
          NInput(v-model:value="form.location.city" :maxlength="100")
        NFormItem(label="Страна")
          NInput(v-model:value="form.location.country" :maxlength="100")
      .editor-columns
        NFormItem(label="Широта")
          NumberField(v-model="form.location.lat" :disabled="busy || (isUser && coordinatesLocked)" aria-label="Широта" min="-90" max="90" step="any")
        NFormItem(label="Долгота")
          NumberField(v-model="form.location.lng" :disabled="busy || (isUser && coordinatesLocked)" aria-label="Долгота" min="-180" max="180" step="any")
      p.editor-hint(v-if="isUser && coordinatesLocked") Координаты заданы для выбранного города.
      p.editor-hint(v-else) Координаты необязательны. Оставьте оба поля пустыми, если положение на карте неизвестно.
    .editor-columns(v-if="hasDates")
      NFormItem(label="Начало" required)
        input.date-field(v-model="form.start" type="datetime-local" required)
      NFormItem(label="Окончание" required)
        input.date-field(v-model="form.end" type="datetime-local" required)
    template(v-if="resource === 'events'")
      NFormItem(label="Количество мест")
        NumberField(v-model="form.capacity" aria-label="Количество мест" placeholder="Без ограничения" min="1" max="100000")
      EventOrganizerField(v-if="show" v-model="form.organizer" :initial-user="entity && 'organizerUser' in entity ? entity.organizerUser : undefined")
    NFormItem(v-if="resource === 'teams'" label="Девиз")
      NInput(v-model:value="form.motto")
    .editor-columns(v-if="resource === 'challenges'")
      NFormItem(label="Цель на одного участника" required)
        NumberField(v-model="form.target" aria-label="Цель на одного участника" min="0" :max="1e9" required :step="form.category === 'distance' || originalFraction ? 'any' : 1")
      NFormItem(label="Единица измерения")
        NInput(v-model:value="form.unit" placeholder="раз / км / посещений")
    p.editor-hint(v-if="resource === 'challenges'") {{ form.category === 'attendance' ? 'Факт посещения: участник отмечает 0 или 1 за день. Укажите число посещений для одного участника за весь период.' : 'Укажите личную цель за весь период. Цели команды и челленджа рассчитываются по числу участников.' }}
    template(v-if="isUser")
      NFormItem(label="Дата вступления в Клан")
        input.date-field(v-model="form.clanJoinedOn" type="date" :max="latestProfileDate()" aria-label="Дата вступления в Клан")
      fieldset.entry-section(v-for="section in entrySections" :key="section.field")
        legend {{ section.label }}
        p.entry-hint Дату можно оставить пустой, если она неизвестна.
        .profile-entry-row(v-for="(entry, index) in form[section.field]" :key="entry.id")
          NInput(v-model:value="entry.text" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :maxlength="1000" :disabled="busy" :aria-label="`${section.label}: текст записи ${index + 1}`" placeholder="Текст записи")
          .profile-entry-controls
            label.entry-date
              span Дата
              input.date-field(:value="entry.date ?? ''" type="date" :disabled="busy" :aria-label="`${section.label}: дата записи ${index + 1}`" @input="updateEntryDate(entry, $event)")
            NButton(secondary type="error" size="small" attr-type="button" :disabled="busy" :aria-label="`${section.label}: удалить запись ${index + 1}`" @click="removeEntry(section.field, entry.id)") Удалить
        NButton(secondary size="small" attr-type="button" :disabled="busy || form[section.field].length >= 100" @click="addEntry(section.field)") {{ section.addLabel }}
        span.entry-count {{ form[section.field].length }} / 100
    .editor-actions
      NButton(:disabled="busy" @click="emit('update:show', false)") Отмена
      NButton(type="primary" attr-type="submit" :loading="busy") Сохранить
</template>

<style scoped>
.editor-form { display: grid; gap: .25rem; }
.editor-form :deep(.n-form-item) { margin: 0; }
.editor-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.editor-actions { display: flex; justify-content: flex-end; gap: .75rem; padding-top: .5rem; }
.editor-hint { color: #999a9e; font-size: .75rem; line-height: 1.6; margin: -.5rem 0 1rem; }
.entry-section { min-width: 0; margin: .5rem 0 1rem; padding: 1rem; border: 1px solid #3c3c3c; border-radius: .5rem; }
.entry-section legend { padding: 0 .4rem; font-weight: 600; }
.entry-hint, .entry-count { color: #999a9e; font-size: .75rem; }
.entry-hint { margin: 0 0 1rem; }
.entry-count { margin-left: .75rem; }
.profile-entry-row { display: grid; gap: .6rem; margin-bottom: 1rem; }
.profile-entry-controls { display: flex; align-items: flex-end; justify-content: space-between; gap: .75rem; }
.entry-date { display: grid; gap: .25rem; width: 13rem; min-width: 0; font-size: .75rem; color: #999a9e; }
.date-field { box-sizing: border-box; width: 100%; min-width: 0; color-scheme: dark; color: inherit; background: #212224; border: 1px solid #3c3c3c; border-radius: .3rem; min-height: 2.5rem; padding: .5rem; font: inherit; }
@media (max-width: 36rem) { .editor-columns { grid-template-columns: 1fr; gap: 0; } }
</style>
