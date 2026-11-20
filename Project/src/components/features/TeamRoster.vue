<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NSelect } from 'naive-ui';
import type { Entity, Participation, TeamRole } from '@shared/contracts';
import { displayProfileName } from '@/domain/profile-identity';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { api, errorMessage } from '@/services/api';

const props = defineProps<{ team: Entity; manage: boolean }>();
const emit = defineEmits<{ saved: [removedUserId?: string] }>();
const names = new Intl.Collator('ru', { numeric: true });
const labels = { captain: 'Капитан', deputy: 'Заместитель', member: 'Участник' };
const order = { captain: 0, deputy: 1, member: 2 };
const roleOptions = (Object.keys(labels) as TeamRole[]).map(value => ({ value, label: labels[value] }));
const roster = computed(() => [...props.team.participants].sort((a,b) => order[a.teamRole ?? 'member'] - order[b.teamRole ?? 'member']
  || names.compare(displayProfileName(a.user), displayProfileName(b.user)) || a.user.id.localeCompare(b.user.id)));
const editing = ref('');
const role = ref<TeamRole>('member');
const removing = ref(false);
const comment = ref('');
const busy = ref(false);
const error = ref('');
function close() { editing.value = ''; removing.value = false; comment.value = ''; error.value = ''; }
function open(part: Participation) {
  close();
  editing.value = part.user.id;
  role.value = part.teamRole ?? 'member';
}
watch(() => props.team.id, close);
watch(roster, rows => { if (editing.value && !rows.some(p => p.user.id === editing.value)) close(); });
async function save() {
  if (busy.value || !props.manage || !editing.value || (removing.value && !comment.value.trim())) return;
  const removedUserId = removing.value ? editing.value : undefined;
  const path = '/teams/' + encodeURIComponent(props.team.id) + '/members/' + encodeURIComponent(editing.value);
  busy.value = true; error.value = '';
  try {
    if (removing.value) await api.post(path + '/exclude', { comment: comment.value.trim() });
    else await api.put(path + '/role', { role: role.value });
    close(); emit('saved', removedUserId);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template>
  <section class="detail-panel team-roster">
    <h2>Участники <small>{{ roster.length }}</small></h2>
    <ul v-if="roster.length" class="roster-list">
      <li v-for="part in roster" :key="part.user.id">
        <div class="roster-row">
          <UserAvatar :user="part.user"><small v-if="part.user.location.city">{{ part.user.location.city }}</small></UserAvatar>
          <span v-if="part.teamRole && part.teamRole !== 'member'" class="roster-role">{{ labels[part.teamRole] }}</span>
          <NButton v-if="manage && editing !== part.user.id" size="small" quaternary :disabled="busy" :aria-label="'Изменить участие: ' + part.user.name" @click="open(part)">Изменить</NButton>
        </div>
        <form v-if="manage && editing === part.user.id" class="roster-form" @submit.prevent="save">
          <template v-if="removing">
            <label :for="'exclude-' + part.user.id">Причина исключения</label>
            <NInput v-model:value="comment" type="textarea" :input-props="{ id: 'exclude-' + part.user.id, required: true }" :maxlength="1000" :disabled="busy" />
          </template>
          <template v-else>
            <NSelect v-model:value="role" aria-label="Роль в команде" :options="roleOptions" :disabled="busy" />
            <small v-if="role === 'captain' && roster.some(p => p.teamRole === 'captain' && p.user.id !== part.user.id)">После сохранения прежний капитан станет участником.</small>
          </template>
          <p v-if="error" role="alert">{{ error }}</p>
          <div class="roster-actions">
            <NButton v-if="!removing && team.status !== 'archived'" size="small" type="error" quaternary :disabled="busy" @click="removing = true">Исключить…</NButton>
            <NButton size="small" :disabled="busy" @click="close">Отмена</NButton>
            <NButton attr-type="submit" size="small" :type="removing ? 'error' : 'primary'" :loading="busy" :disabled="removing ? !comment.trim() : role === (part.teamRole ?? 'member')">{{ removing ? 'Исключить из команды' : 'Сохранить роль' }}</NButton>
          </div>
        </form>
      </li>
    </ul>
    <p v-else>В команде пока нет участников.</p>
  </section>
</template>

<style scoped>
.team-roster h2{display:flex;align-items:baseline;gap:.6rem}.team-roster small,.team-roster>p{color:var(--muted);font-size:.77rem}.roster-list{list-style:none;padding:0;margin:0}.roster-list li+li{border-top:1px solid var(--border)}.roster-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.55rem 0}.roster-row>.user-avatar{flex:1;min-width:9rem}.roster-role{font-size:.73rem;color:#f0b17f}.roster-form{display:grid;gap:.55rem;padding:.75rem;background:var(--surface);border:1px solid var(--border);border-radius:.5rem;margin-bottom:.5rem}.roster-form label{font-size:.8rem}.roster-form p{color:#f1a19b;margin:0}.roster-actions{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end}
</style>
