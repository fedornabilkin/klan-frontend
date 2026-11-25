<script setup lang="ts">
import UserAvatar from "@/components/ui/UserAvatar.vue";
import { computed, ref, watch } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { ApiResponse, User } from '@shared/contracts';
import { api } from '@/services/api';
import Icon from '@/components/ui/Icon.vue';
import ProfileLinkedText from '@/components/ui/ProfileLinkedText.vue';

const props = defineProps<{ user: User; field: 'name' | 'bio'; editable: boolean }>();
const emit = defineEmits<{ saved: [user: User] }>();
const editing = ref(false); const draft = ref(''); const busy = ref(false); const error = ref('');
const isName = computed(() => props.field === 'name');
const label = computed(() => isName.value ? 'Имя и фамилия' : 'О себе');
const bioPrompt = 'Чем занимаешься? С чем к тебе можно обратиться? Что ищешь сам?';
function start() { draft.value = props.user[props.field]; error.value = ''; editing.value = true; }
function cancel() { if (!busy.value) { editing.value = false; error.value = ''; } }
watch(() => props.user.id, () => { editing.value = false; error.value = ''; });
watch(() => props.editable, value => { if (!value) editing.value = false; });
async function save() {
  if (!props.editable || busy.value) return;
  const value = draft.value.trim();
  if (isName.value && !value) { error.value = 'Укажите имя.'; return; }
  if (value.length > (isName.value ? 120 : 5000)) { error.value = 'Текст превышает допустимую длину.'; return; }
  const userId = props.user.id;
  busy.value = true; error.value = '';
  try {
    const result = await api.patch<ApiResponse<User>>(`/users/${encodeURIComponent(userId)}`, { [props.field]: value });
    emit('saved', result.data);
    if (props.user.id === userId) editing.value = false;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось сохранить изменения.'; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="profile-text" :class="{ 'profile-text--name': isName }">
    <div v-if="!isName" class="block-heading">
      <h2>О себе</h2>
      <NButton v-if="editable && !editing" quaternary size="small" aria-label="Изменить описание профиля" @click="start">
        <template #icon><Icon name="pen" /></template>Изменить
      </NButton>
    </div>
    <form v-if="editing" class="inline-form" @submit.prevent="save">
      <label :for="`profile-${field}-${user.id}`">{{ label }}</label>
      <NInput v-model:value="draft" :input-props="{ id: `profile-${field}-${user.id}`, 'aria-label': label }" :type="isName ? 'text' : 'textarea'" :maxlength="isName ? 120 : 5000" :autosize="isName ? undefined : { minRows: 4, maxRows: 12 }" :disabled="busy" :placeholder="isName ? 'Как к вам обращаться' : bioPrompt" />
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <div class="inline-actions">
        <NButton :disabled="busy" @click="cancel">Отмена</NButton>
        <NButton type="primary" attr-type="submit" :loading="busy">Сохранить</NButton>
      </div>
    </form>
    <div v-else-if="isName" class="name-row">
      <h1><UserAvatar :user="user" /></h1>
      <NButton v-if="editable" quaternary circle aria-label="Изменить имя" @click="start"><template #icon><Icon name="pen" /></template></NButton>
    </div>
    <p v-else class="profile-bio"><ProfileLinkedText :text="user.bio || (editable ? bioPrompt : 'Участник пока не рассказал о себе.')" :telegram-username="user.username" /></p>
  </div>
</template>

<style scoped>
.name-row :deep(.n-button){min-width:2.75rem;min-height:2.75rem}
.profile-text{min-width:0}.block-heading,.name-row{display:flex;align-items:center;justify-content:space-between;gap:.6rem}.block-heading{margin-bottom:.8rem;flex-wrap:wrap}.block-heading h2{font-size:1rem;font-weight:650;margin:0;letter-spacing:-.02em}.block-heading .n-button{font-size:.72rem}.name-row h1{min-width:0;overflow-wrap:anywhere;font-size:clamp(1.7rem,3.5vw,2.4rem);line-height:1.15;margin:.45rem 0 .6rem;letter-spacing:-.05em;color:#f2efeb}.name-row .n-button{flex-shrink:0}.profile-bio{white-space:pre-line;color:#b4aca6;line-height:1.9;font-size:.86rem;margin:0;overflow-wrap:anywhere}.inline-form{display:grid;grid-template-columns:minmax(0,1fr);gap:.7rem}.inline-form>label{font-size:.75rem;color:#b9aaa0}.profile-text--name .inline-form{margin:.6rem 0 1rem}.inline-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:.5rem}.inline-actions .n-button{min-height:2.75rem}.inline-error{color:#f2a19b;font-size:.8rem;margin:0;overflow-wrap:anywhere}@media(max-width:45rem){.name-row h1{font-size:1.6rem}.inline-actions .n-button{flex:1}}
</style>
