<script setup lang="ts">
import { computed, ref } from 'vue'
import { NAlert, NButton, NInput, NUpload, type UploadFileInfo } from 'naive-ui'
import type { ApiResponse, ProfileEntryInput, User } from '@shared/contracts'
import { isCalendarDate } from '@shared/profile-entries'
import { formatProfileName, latestProfileDate, normalizeTelegramUsername } from '@shared/profile-identity'
import { userPath } from '@shared/user-links'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import Icon from '@/components/ui/Icon.vue'

const auth = useAuthStore()
const json = ref('')
const error = ref('')
const success = ref('')
const busy = ref(false)
const exportBusy = ref(false)
type ImportIdentity = Partial<Pick<User, 'firstName' | 'middleName' | 'lastName' | 'callsign' | 'birthDate' | 'clanJoinedOn'>> & { username?: string | null }
type ImportProfile = ImportIdentity & { name: string; bio: string; location: { city: string; country: string; lat: number | null; lng: number | null }; facts: ProfileEntryInput[]; interests: string[]; achievements: ProfileEntryInput[]; tags: { id: string; name: string }[] }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function strings(value: unknown, field: string, maxLength = 250) {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.length <= maxLength) || value.length > 40) throw new Error(`${field}: максимум 40 строк, до ${maxLength} символов в каждой.`)
  return value.map(item => item.trim()).filter(Boolean)
}
function profileEntries(value: unknown, field: string): ProfileEntryInput[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${field}: максимум 100 записей.`)
  const ids = new Set<string>()
  return value.map((entry, index) => {
    const label = `${field}, запись ${index + 1}`
    const text = typeof entry === 'string' ? entry : record(entry) ? entry.text : undefined
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) throw new Error(`${label}: нужен непустой текст до 1000 символов.`)
    if (typeof entry === 'string') return entry
    if (!record(entry) || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(entry.id)) throw new Error(`${label}: id должен содержать 1–120 латинских букв, цифр, дефисов или подчёркиваний и начинаться с буквы или цифры.`)
    if (ids.has(entry.id)) throw new Error(`${label}: id повторяется. У каждой записи в разделе должен быть свой идентификатор.`)
    ids.add(entry.id)
    if (entry.date !== null && (typeof entry.date !== 'string' || !isCalendarDate(entry.date))) throw new Error(`${label}: date — существующая дата в формате ГГГГ-ММ-ДД или null, если дата неизвестна.`)
    return { id: entry.id, text, date: entry.date as string | null }
  })
}
function parseProfile(text: string): ImportProfile {
  const parsed: unknown = JSON.parse(text)
  if (!record(parsed)) throw new Error('В файле должен быть JSON-объект.')
  const body = record(parsed.data) ? parsed.data : parsed
  const p = record(body.profile) ? body.profile : body
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) throw new Error('Укажите имя в поле profile.name (до 120 символов).')
  // Only explicitly supplied identity fields are imported: old JSON files must
  // not clear newer profile data or infer a person's name parts and birth date.
  const identity: ImportIdentity = {}
  const nameFields = ['firstName', 'middleName', 'lastName'] as const
  if (nameFields.some(field => p[field] !== undefined)) {
    for (const field of nameFields) {
      const value = p[field]
      if (typeof value !== 'string' || value.trim().length > 120) throw new Error('Передайте firstName, middleName и lastName вместе: строки до 120 символов, пустая строка — если фамилия или отчество не указаны.')
      identity[field] = value.trim()
    }
    if (!identity.firstName) throw new Error('Поле firstName должно содержать имя.')
    const name = formatProfileName({ firstName: identity.firstName, middleName: identity.middleName!, lastName: identity.lastName! })
    if (name.length > 120 || name !== p.name.trim()) throw new Error('Поле name должно совпадать с firstName, middleName и lastName в таком порядке; вместе — не более 120 символов.')
  }
  if (p.callsign !== undefined) {
    if (typeof p.callsign !== 'string' || p.callsign.trim().length > 120) throw new Error('Позывной callsign должен содержать текст до 120 символов.')
    identity.callsign = p.callsign.trim()
  }
  if (p.username !== undefined) {
    if (p.username !== null && typeof p.username !== 'string') throw new Error('Поле username должно содержать Telegram username или null для очистки.')
    const username = p.username === null ? '' : normalizeTelegramUsername(p.username)
    if (username && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) throw new Error('Username Telegram: от 5 до 32 латинских букв, цифр или знаков подчёркивания; первый символ — буква.')
    identity.username = username || null
  }
  for (const field of ['birthDate', 'clanJoinedOn'] as const) {
    const value = p[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== 'string' || !isCalendarDate(value) || value > latestProfileDate()))
      throw new Error(`Поле ${field} должно содержать дату ГГГГ-ММ-ДД не позднее сегодняшней или null для очистки.`);
    identity[field] = value;
  }
  if (p.bio !== undefined && (typeof p.bio !== 'string' || p.bio.length > 5000)) throw new Error('Поле bio должно содержать текст до 5000 символов.')
  const location = record(p.location) ? p.location : {}
  const lat = location.lat ?? null; const lng = location.lng ?? null
  if (!(lat === null && lng === null) && (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 || typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180)) throw new Error('Координаты: широта от −90 до 90, долгота от −180 до 180. Если положение неизвестно, укажите null в обоих полях.')
  if (location.city !== undefined && typeof location.city !== 'string' || location.country !== undefined && typeof location.country !== 'string') throw new Error('Город и страна должны быть текстом.')
  const tags = p.tags ?? []
  if (!Array.isArray(tags) || tags.length > 30 || !tags.every(t => record(t) && typeof t.id === 'string' && t.id.length > 0 && typeof t.name === 'string' && t.name.trim().length > 0)) throw new Error('Теги: максимум 30 объектов с непустыми полями id и name.')
  return {
    ...identity, name: p.name.trim(), bio: String(p.bio ?? ''),
    location: { city: String(location.city ?? '').trim(), country: String(location.country ?? '').trim(), lat: lat as number | null, lng: lng as number | null },
    facts: profileEntries(p.facts, 'Факты'), interests: strings(p.interests, 'Интересы'), achievements: profileEntries(p.achievements, 'Достижения'),
    tags: tags.map(t => ({ id: t.id as string, name: t.name as string })),
  }
}
const preview = computed(() => { if (!json.value.trim()) return null; try { return { data: parseProfile(json.value), error: '' } } catch(e) { return { data: null, error: e instanceof SyntaxError ? 'JSON содержит синтаксическую ошибку. Проверьте кавычки и запятые.' : e instanceof Error ? e.message : 'Не удалось прочитать JSON.' } } })
const previewUser = computed(() => {
  const profile = preview.value?.data;
  if (!auth.user || !profile) return null;
  return { ...auth.user, name:profile.name, firstName:profile.firstName, lastName:profile.lastName,
    callsign:profile.callsign, initials:profile.name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase() };
});
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function template() {
  const example = { schemaVersion: 2, profile: { name: auth.user?.name ?? 'Имя Фамилия', bio: 'Несколько слов о себе', location: { city: '', country: '', lat: null, lng: null }, facts: [{ id: crypto.randomUUID(), text: 'Замените этот текст фактом о себе', date: null }], interests: [], achievements: [], tags: [] } }
  json.value = JSON.stringify(example, null, 2)
  download(example, 'klan-profile-template.json')
  success.value = ''; error.value = ''
}
async function exportProfile() {
  exportBusy.value = true; error.value = ''
  try {
    const result = await api.get<ApiResponse<unknown>>('/users/me/export')
    download(result.data ?? result, 'klan-my-profile.json')
  } catch(e) { error.value = e instanceof Error ? e.message : 'Не удалось выгрузить профиль.' }
  finally { exportBusy.value = false }
}
async function readFile({ file }: { file: UploadFileInfo }) {
  error.value = ''; success.value = ''
  if (!file.file) return false
  if (file.file.size > 1024 * 1024) { error.value = 'Размер файла не должен превышать 1 МБ.'; return false }
  try { json.value = await file.file.text() } catch { error.value = 'Не удалось прочитать файл.' }
  return false
}
async function importProfile() {
  if (busy.value || !preview.value?.data) return
  busy.value = true; error.value = ''; success.value = ''
  try {
    await api.post('/users/me/import', { profile: preview.value.data })
    await auth.restore(true)
    success.value = 'Профиль обновлён. Данные доступны на вашей странице.'
  } catch(e) { error.value = e instanceof Error ? e.message : 'Не удалось импортировать профиль.' }
  finally { busy.value = false }
}
</script>

<template lang="pug">
.import-page
  PageHeader(title="Ваши данные — с вами" eyebrow="ИМПОРТ И ЭКСПОРТ" description="Сохраните профиль в JSON или перенесите информацию из подготовленного файла.")
  .import-grid
    section.import-panel
      .import-panel-icon
        Icon(name="download")
      h2 Сохранить профиль
      p Выгрузите ФИО, позывной, Telegram username, дату рождения, географию, теги, факты и достижения вместе с их датами. Файл можно отредактировать и загрузить обратно — идентификаторы записей сохранятся.
      NButton(:loading="exportBusy" @click="exportProfile") Скачать мой JSON
      .import-divider
      h3 Начать с шаблона
      p Заполните заготовку своими данными. Теги из существующего профиля сохраняются при экспорте с их идентификаторами.
      NButton(secondary @click="template") Скачать шаблон
      details.import-format
        summary Формат фактов и достижений
        p До 100 записей в каждом разделе, текст — до 1000 символов. Новая запись содержит id, text и date. Для неизвестной даты укажите null. Старые файлы со строками вместо объектов тоже поддерживаются.
        pre {{ '{ "id": "my-entry-1", "text": "Текст записи", "date": null }' }}
        p Для известной даты используйте формат «2026-11-11». Дата не извлекается из текста автоматически. Сохраняйте id существующей записи при редактировании файла.
      .import-note
        Icon(name="shield-halved")
        span Импорт изменяет только ваш профиль. Роли, участие в командах и результаты остаются под управлением сервиса.
    section.import-panel.import-main
      h2 Загрузить данные
      p Выберите файл .json или вставьте содержимое в поле ниже.
      NUpload(accept=".json,application/json" :show-file-list="false" :default-upload="false" @before-upload="readFile")
        NButton(dashed block)
          template(#icon)
            Icon(name="upload")
          | Выбрать JSON-файл
      NInput.json-editor(v-model:value="json" type="textarea" :rows="12" placeholder='{"profile": {"name": "Имя Фамилия", ...}}' aria-label="Данные профиля в JSON" :input-props="{ spellcheck: false }")
      NAlert(v-if="preview?.error" type="warning" :show-icon="false") {{ preview.error }}
      .import-preview(v-if="preview?.data")
        span.preview-label ПРЕДПРОСМОТР
        UserAvatar(v-if="previewUser" :user="previewUser")
        span {{ [preview.data.location.city, preview.data.location.country].filter(Boolean).join(', ') || 'География не указана' }}
        p {{ preview.data.facts.length }} фактов · {{ preview.data.achievements.length }} достижений · {{ preview.data.interests.length }} интересов · {{ preview.data.tags.length }} тегов
      NAlert(v-if="error" type="error" :show-icon="false") {{ error }}
      NAlert(v-if="success" type="success" :show-icon="false")
        | {{ success }}
        RouterLink.import-profile-link(v-if="auth.user" :to="userPath(auth.user)") Открыть профиль →
      p.replace-note(v-if="preview?.data") Имя, описание и перечисленные поля профиля будут заменены содержимым файла. Перед импортом можно скачать текущую версию.
      NButton(type="primary" :disabled="!preview?.data" :loading="busy" @click="importProfile") Обновить мой профиль
</template>

<style scoped>
.import-page { display: grid; gap: 1.5rem; }
.import-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem; align-items: start; }
.import-panel { padding: 1.75rem; background: #191a1c; border: 1px solid #2b2c2e; border-radius: .75rem; }
.import-panel h2 { font-size: 1.1rem; margin: 0 0 .75rem; }
.import-panel h3 { font-size: .95rem; margin: 0; }
.import-panel > p { color: #949499; line-height: 1.7; font-size: .85rem; margin: 0 0 1.25rem; }
.import-panel-icon { color: #ff8533; margin-bottom: 1rem; font-size: 1.5rem; }
.import-divider { height: 1px; background: #ffffff0b; margin: 1.75rem 0; }
.import-panel h3 + p { margin-top: .65rem; }
.import-note { display: flex; gap: .75rem; align-items: flex-start; color: #7f8085; font-size: .75rem; line-height: 1.6; margin-top: 2rem; }
.import-note :deep(svg) { color: #b67444; flex-shrink: 0; margin-top: .2rem; }
.import-main { display: grid; gap: 1rem; }
.import-main h2, .import-main > p { margin: 0; }
.json-editor :deep(textarea) { font-family: 'Consolas', 'Courier New', monospace; font-size: .75rem; }
.import-preview { display: grid; gap: .35rem; background: #ff7a0008; border: 1px solid #ff7a0025; border-radius: .4rem; padding: 1rem; }
.preview-label { color: #d6854c; font-size: .6rem; letter-spacing: .12em; }
.import-preview strong { font-size: 1rem; }
.import-preview > span:not(.preview-label), .import-preview p { color: #aaa; font-size: .75rem; margin: 0; }
.import-main .replace-note { font-size: .75rem; color: #8d8e93; }
.import-profile-link { display: block; color: inherit; margin-top: .4rem; }
.import-format { margin-top: 1rem; font-size: .75rem; color: #a4a49f; line-height: 1.65; }
.import-format summary { cursor: pointer; color: #dca478; }
.import-format p { margin: .7rem 0; }
.import-format pre { margin: .65rem 0; padding: .65rem; border-radius: .35rem; background: #111313; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .7rem; }
@media(max-width: 48rem) { .import-grid { grid-template-columns: 1fr; } .import-panel { padding: 1.25rem; } }
</style>
