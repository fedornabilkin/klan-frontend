<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId, watch } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { ApiResponse, User } from '@shared/contracts';
import { normalizeTelegramUsername } from '@shared/profile-identity';
import { identityDraft, identityPatch, identitySavedFields, localCalendarDate, type IdentityDraft, type IdentitySavedField } from '@/domain/profile-identity';
import { api, errorMessage } from '@/services/api';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ user: User; editable: boolean }>();
const emit = defineEmits<{ saved: [user: User, fields: IdentitySavedField[]] }>();
const formId = useId();
const element = ref<HTMLElement | null>(null);
const editing = ref(false);
const busy = ref(false);
const error = ref('');
const announcement = ref('');
const initial = ref(identityDraft(props.user));
const draft = reactive<IdentityDraft>({ ...initial.value.draft });
const telegramUsername = computed(() => {
  const value = normalizeTelegramUsername(props.user.username || '');
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) ? value : '';
});
const birthDateLabel = computed(() => props.user.birthDate
  ? new Date(`${props.user.birthDate}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  : '');

async function start() {
  if (!props.editable || busy.value) return;
  initial.value = identityDraft(props.user);
  Object.assign(draft, initial.value.draft);
  error.value = ''; announcement.value = ''; editing.value = true;
  await nextTick();
  element.value?.querySelector<HTMLInputElement>('input')?.focus();
}
function cancel() {
  if (busy.value) return;
  editing.value = false; error.value = '';
  nextTick(() => element.value?.querySelector<HTMLButtonElement>('.identity-edit')?.focus());
}
watch(() => props.user.id, () => { editing.value = false; error.value = ''; announcement.value = ''; });
watch(() => props.editable, value => { if (!value) editing.value = false; });
async function save() {
  if (!props.editable || busy.value) return;
  error.value = '';
  const userId = props.user.id;
  try {
    const patch = identityPatch(draft, initial.value.draft);
    if (!Object.keys(patch).length) { cancel(); return; }
    const latest = identityDraft(props.user).draft;
    if ((Object.keys(patch) as (keyof IdentityDraft)[]).some(field => latest[field] !== initial.value.draft[field])) {
      error.value = 'Эти данные уже изменились в другой вкладке. Скопируйте нужные изменения и откройте форму заново.';
      return;
    }
    busy.value = true;
    const result = await api.patch<ApiResponse<User>>(`/users/${encodeURIComponent(userId)}`, patch);
    if (props.user.id === userId) {
      emit('saved', result.data, identitySavedFields(patch));
      editing.value = false; announcement.value = 'Личные данные сохранены.';
      await nextTick();
      element.value?.querySelector<HTMLButtonElement>('.identity-edit')?.focus();
    }
  } catch (cause) { if (props.user.id === userId) error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template>
  <div ref="element" class="profile-identity">
    <div class="identity-heading">
      <h1>{{ user.name }}</h1>
      <NButton v-if="editable && !editing" class="identity-edit" quaternary size="small" @click="start">
        <template #icon><Icon name="pen" /></template>Изменить данные
      </NButton>
    </div>
    <form v-if="editing" class="identity-form" @submit.prevent="save">
      <h2>Личные данные</h2>
      <p v-if="initial.legacyName" class="identity-hint">
        Проверьте порядок ФИО при первом редактировании.
        <template v-if="initial.ambiguousName"> Прежнее имя целиком оставлено в поле «Имя», чтобы сохранить все данные. Распределите его по полям.</template>
      </p>
      <div class="identity-grid">
        <div class="identity-field">
          <label :for="`${formId}-lastName`">Фамилия</label>
          <NInput v-model:value="draft.lastName" :disabled="busy" :maxlength="120" :input-props="{ id: `${formId}-lastName`, autocomplete: 'family-name' }" placeholder="Фамилия" />
        </div>
        <div class="identity-field">
          <label :for="`${formId}-firstName`">Имя</label>
          <NInput v-model:value="draft.firstName" :disabled="busy" :maxlength="120" :input-props="{ id: `${formId}-firstName`, autocomplete: 'given-name', required: true }" placeholder="Имя" />
        </div>
        <div class="identity-field">
          <label :for="`${formId}-middleName`">Отчество</label>
          <NInput v-model:value="draft.middleName" :disabled="busy" :maxlength="120" :input-props="{ id: `${formId}-middleName`, autocomplete: 'additional-name' }" placeholder="Если есть" />
        </div>
        <div class="identity-field">
          <label :for="`${formId}-callsign`">Позывной</label>
          <NInput v-model:value="draft.callsign" :disabled="busy" :maxlength="120" :input-props="{ id: `${formId}-callsign`, autocomplete: 'nickname' }" placeholder="Ваш позывной" />
        </div>
        <div class="identity-field">
          <label :for="`${formId}-username`">Username в Telegram</label>
          <NInput v-model:value="draft.username" :disabled="busy" :maxlength="33" :input-props="{ id: `${formId}-username`, autocapitalize: 'none', spellcheck: false }" placeholder="@username" />
        </div>
        <div class="identity-field">
          <label :for="`${formId}-birthDate`">Дата рождения</label>
          <input :id="`${formId}-birthDate`" v-model="draft.birthDate" class="identity-date" type="date" :max="localCalendarDate()" :disabled="busy" autocomplete="bday" />
        </div>
      </div>
      <p class="identity-hint">Необязательные поля можно оставить пустыми.</p>
      <p v-if="error" class="identity-error" role="alert">{{ error }}</p>
      <div class="identity-actions">
        <NButton :disabled="busy" @click="cancel">Отмена</NButton>
        <NButton type="primary" attr-type="submit" :loading="busy">Сохранить</NButton>
      </div>
    </form>
    <template v-else>
      <div v-if="user.callsign || user.activeTeams?.length" class="identity-affiliation">
        <span v-if="user.callsign" class="identity-callsign"><span>Позывной</span> <strong>{{ user.callsign }}</strong></span>
        <RouterLink v-for="team in user.activeTeams || []" :key="team.id" class="identity-team" :to="`/teams/${team.publicId ?? team.id}`">
          <Icon name="shield-halved" />{{ team.title }}
        </RouterLink>
      </div>
      <div v-if="telegramUsername || birthDateLabel" class="identity-contact">
        <a v-if="telegramUsername" :href="`https://t.me/${telegramUsername}`" target="_blank" rel="noopener noreferrer"><Icon name="telegram" />@{{ telegramUsername }}</a>
        <span v-if="birthDateLabel" class="identity-birthday"><Icon name="calendar" /><span>Дата рождения: <time :datetime="user.birthDate || undefined">{{ birthDateLabel }}</time></span></span>
      </div>
    </template>
    <span class="identity-announcement" role="status">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.profile-identity{min-width:0}.identity-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.4rem .8rem}.identity-heading h1{min-width:0;overflow-wrap:anywhere;font-size:clamp(1.7rem,3.5vw,2.4rem);line-height:1.15;margin:.45rem 0 .6rem;letter-spacing:-.05em;color:#f2efeb}.identity-edit{flex-shrink:0;min-height:2.75rem;font-size:.75rem}.identity-affiliation,.identity-callsign,.identity-contact,.identity-birthday{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}.identity-affiliation{margin:.25rem 0 .5rem;gap:.5rem .8rem}.identity-callsign{color:#a99e94;font-size:.85rem}.identity-callsign strong{color:#e7bd99;font-weight:600}.identity-team{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #5a4130;border-radius:.35rem;padding:.35rem .55rem;background:#32251c;color:#ebbd99;text-decoration:none;font-size:.75rem;overflow-wrap:anywhere}.identity-team:hover{border-color:#d88d52;color:#ffcfaa}.identity-contact{gap:.25rem 1.1rem;margin:.15rem 0 .5rem;font-size:.8rem}.identity-contact a{display:inline-flex;align-items:center;gap:.45rem;min-height:2rem;color:#e7a471;text-decoration:none;overflow-wrap:anywhere}.identity-contact a:hover{text-decoration:underline;color:#ffc393}.identity-birthday{color:#a99e94;font-size:.75rem}.identity-team:focus-visible,.identity-contact a:focus-visible{outline:2px solid var(--accent);outline-offset:.2rem}.identity-form{margin:.6rem 0 1rem;border:1px solid #44392f;border-radius:.7rem;background:#1c1917;padding:1rem;display:grid;gap:.8rem}.identity-form h2{margin:0;font-size:.95rem;font-weight:600}.identity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}.identity-field{min-width:0;display:flex;flex-direction:column;gap:.35rem}.identity-field label{font-size:.75rem;color:#c9b7a8}.identity-date{box-sizing:border-box;width:100%;min-width:0;height:34px;border:1px solid #ffffff17;border-radius:3px;padding:0 .7rem;background:#ffffff1a;color:#eee;font:inherit;font-size:.85rem;color-scheme:dark}.identity-date:focus{outline:1px solid var(--accent);border-color:var(--accent)}.identity-date:disabled{opacity:.5}.identity-form .identity-hint{margin:0;color:#aa998c;font-size:.75rem;line-height:1.65}.identity-form .identity-error{margin:0;color:#f2a19b;font-size:.8rem;line-height:1.5}.identity-actions{display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}.identity-actions .n-button{min-height:2.75rem}.identity-announcement{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:62rem){.identity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:38rem){.identity-grid{grid-template-columns:1fr}.identity-heading h1{font-size:1.6rem}.identity-actions .n-button{flex:1}.identity-heading{align-items:flex-start;flex-direction:column}.identity-form{padding:.8rem}}
</style>
