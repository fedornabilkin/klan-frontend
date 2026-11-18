<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton } from 'naive-ui';
import type { ApiResponse, Location, User } from '@shared/contracts';
import { api } from '@/services/api';
import Icon from '@/components/ui/Icon.vue';
import CountryCityEditor from './CountryCityEditor.vue';

const props = defineProps<{ user: User; editable: boolean }>();
const emit = defineEmits<{ saved: [user: User] }>();
const editing = ref(false); const busy = ref(false); const error = ref('');
const draft = ref<Location>({ country: '', city: '', lat: null, lng: null });
const label = computed(() => [props.user.location.city, props.user.location.country].filter(value => value.trim()).join(', ') || 'Город не указан');
function start() { draft.value = { ...props.user.location }; error.value = ''; editing.value = true; }
function cancel() { if (!busy.value) { editing.value = false; error.value = ''; } }
watch(() => props.user.id, () => { editing.value = false; error.value = ''; });
watch(() => props.editable, value => { if (!value) editing.value = false; });
async function save() {
  if (!props.editable || busy.value) return;
  const userId = props.user.id;
  busy.value = true; error.value = '';
  try {
    const result = await api.patch<ApiResponse<User>>(`/users/${encodeURIComponent(userId)}`, { location: { ...draft.value } });
    emit('saved', result.data);
    if (props.user.id === userId) editing.value = false;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось сохранить местоположение.'; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="profile-location">
    <form v-if="editing" class="location-form" @submit.prevent="save">
      <CountryCityEditor v-model="draft" :disabled="busy" />
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <div class="inline-actions">
        <NButton :disabled="busy" @click="cancel">Отмена</NButton>
        <NButton type="primary" attr-type="submit" :loading="busy">Сохранить</NButton>
      </div>
    </form>
    <div v-else class="location-row">
      <p><Icon name="location-dot" /><span>{{ label }}</span></p>
      <NButton v-if="editable" quaternary circle aria-label="Изменить местоположение" @click="start"><template #icon><Icon name="pen" /></template></NButton>
    </div>
  </div>
</template>

<style scoped>
.location-row :deep(.n-button){min-width:2.75rem;min-height:2.75rem}
.profile-location{min-width:0}.location-row{display:flex;align-items:center;gap:.5rem}.location-row p{display:flex;align-items:baseline;gap:.5rem;margin:0;color:#9f948c;font-size:.8rem;min-width:0}.location-row p span{overflow-wrap:anywhere}.location-row svg,.location-row .n-button{flex-shrink:0}.location-form{display:grid;grid-template-columns:minmax(0,1fr);gap:.7rem;padding:.9rem;margin:.4rem 0;border:1px solid #40372f;border-radius:.6rem;background:#1a1919}.inline-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:.5rem}.inline-actions .n-button{min-height:2.75rem}.inline-error{color:#f2a19b;font-size:.8rem;margin:0;overflow-wrap:anywhere}@media(max-width:35rem){.inline-actions .n-button{flex:1}}
</style>
