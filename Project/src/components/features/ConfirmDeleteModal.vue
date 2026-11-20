<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NButton, NAlert } from 'naive-ui'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import type { Resource, User } from '@shared/contracts'
import { api } from '@/services/api'
const props = defineProps<{ show: boolean; resource: Resource; id: string; title: string; user?: User }>()
const emit = defineEmits<{ 'update:show': [boolean]; deleted: [] }>()
const busy = ref(false)
const error = ref('')
watch(() => props.show, () => { error.value = '' })
async function remove() {
  busy.value = true
  try { await api.delete(`/${props.resource}/${props.id}`); emit('deleted'); emit('update:show', false) }
  catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось удалить запись.' }
  finally { busy.value = false }
}
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Удалить запись?" :style="{ width: 'min(28rem, calc(100vw - 2rem))' }" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="emit('update:show', $event)")
  UserAvatar(v-if="user" :user="user")
  p(v-if="user") Профиль будет удалён. Это действие нельзя отменить.
  p(v-else) Запись «{{ title }}» будет удалена. Это действие нельзя отменить.
  NAlert(v-if="error" type="error") {{ error }}
  .delete-actions
    NButton(:disabled="busy" @click="emit('update:show', false)") Отмена
    NButton(type="error" :loading="busy" @click="remove") Удалить
</template>
<style scoped>
.delete-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.5rem; }
</style>
