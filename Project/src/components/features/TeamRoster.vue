<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NModal } from 'naive-ui';
import type { Entity, Participation, TeamRole } from '@shared/contracts';
import { displayProfileName } from '@/domain/profile-identity';
import Icon from '@/components/ui/Icon.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { api, errorMessage } from '@/services/api';

const props = defineProps<{ team: Entity; manage: boolean }>();
const emit = defineEmits<{ saved: [removedUserId?: string] }>();
const names = new Intl.Collator('ru', { numeric: true });
const labels = { captain: 'Капитан', deputy: 'Заместитель', member: 'Участник' };
const order = { captain: 0, deputy: 1, member: 2 };
const roleButtons = [
  { role: 'captain', icon: 'user-tie', assign: 'Назначить капитаном', remove: 'Снять роль капитана' },
  { role: 'deputy', icon: 'user-secret', assign: 'Назначить заместителем', remove: 'Снять роль заместителя' },
] as const;
type Action = TeamRole | 'exclude';
const roster = computed(() => [...props.team.participants].sort((a,b) => order[a.teamRole ?? 'member'] - order[b.teamRole ?? 'member']
  || names.compare(displayProfileName(a.user), displayProfileName(b.user)) || a.user.id.localeCompare(b.user.id)));
const pending = ref<{ userId: string; wasRole: TeamRole; action: Action; label: string } | null>(null);
const selected = computed(() => roster.value.find(p => p.user.id === pending.value?.userId));
const captain = computed(() => roster.value.find(p => p.teamRole === 'captain'));
const removing = computed(() => pending.value?.action === 'exclude');
const comment = ref('');
const busy = ref(false);
const error = ref('');
function close() { pending.value = null; comment.value = ''; error.value = ''; }
function rolesFor(part: Participation) {
  return roleButtons.map(button => {
    const active = part.teamRole === button.role;
    return { icon: button.icon, active, label: active ? button.remove : button.assign, action: active ? 'member' as const : button.role };
  });
}
function confirm(part: Participation, action: Action, label: string) {
  if (!props.manage || busy.value) return;
  close();
  pending.value = { userId: part.user.id, wasRole: part.teamRole ?? 'member', action, label };
}
watch(() => props.team.id, close);
watch([selected, () => props.manage, () => props.team.status], () => {
  const request = pending.value;
  if (request && (!props.manage || !selected.value || (selected.value.teamRole ?? 'member') !== request.wasRole
      || (removing.value && props.team.status === 'archived'))) close();
});
async function save() {
  const request = pending.value;
  if (!request || !selected.value || busy.value || !props.manage || (removing.value && !comment.value.trim())) return;
  const removedUserId = removing.value ? request.userId : undefined;
  const path = '/teams/' + encodeURIComponent(props.team.id) + '/members/' + encodeURIComponent(request.userId);
  busy.value = true; error.value = '';
  try {
    if (removing.value) await api.post(path + '/exclude', { comment: comment.value.trim() });
    else await api.put(path + '/role', { role: request.action });
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
          <div class="roster-person">
            <UserAvatar :user="part.user" />
            <span v-if="part.teamRole && part.teamRole !== 'member'" class="roster-role">{{ labels[part.teamRole] }}</span>
          </div>
          <div v-if="manage" class="roster-tools">
            <NButton v-for="button in rolesFor(part)" :key="button.icon" circle size="small" secondary
              :type="button.active ? 'primary' : 'default'" :aria-pressed="button.active" :title="button.label"
              :aria-label="button.label + ' — ' + displayProfileName(part.user)"
              :disabled="busy" @click="confirm(part, button.action, button.label)">
              <template #icon><Icon :name="button.icon" /></template>
            </NButton>
            <NButton v-if="team.status !== 'archived'" circle size="small" type="error" quaternary :disabled="busy"
              title="Исключить из команды" :aria-label="'Исключить из команды — ' + displayProfileName(part.user)"
              @click="confirm(part, 'exclude', 'Исключить из команды')"><template #icon><Icon name="xmark" /></template></NButton>
          </div>
        </div>
      </li>
    </ul>
    <p v-else>В команде пока нет участников.</p>
    <NModal :show="!!pending" preset="card" class="roster-modal" :style="{ width: 'min(28rem, calc(100vw - 2rem))' }"
      :title="pending ? pending.label + '?' : ''" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy"
      @update:show="open => { if (!open && !busy) close() }">
      <form v-if="pending && selected" class="roster-form" @submit.prevent="save">
        <UserAvatar :user="selected.user" />
        <p v-if="pending.action === 'captain' && captain">После назначения {{ displayProfileName(captain.user) }} станет обычным участником команды.</p>
        <p v-else-if="pending.action === 'member'">Участник останется в составе команды.</p>
        <template v-if="removing">
          <label for="team-exclusion-comment">Причина исключения</label>
          <NInput v-model:value="comment" type="textarea" :maxlength="1000" :disabled="busy"
            :input-props="{ id: 'team-exclusion-comment', required: true }" />
        </template>
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="roster-actions">
          <NButton :disabled="busy" @click="close">Отмена</NButton>
          <NButton attr-type="submit" :type="removing ? 'error' : 'primary'" :loading="busy" :disabled="removing && !comment.trim()">{{ pending.label }}</NButton>
        </div>
      </form>
    </NModal>
  </section>
</template>

<style scoped>
.team-roster h2{display:flex;align-items:baseline;gap:.6rem}
.team-roster small,.team-roster>p{color:var(--muted);font-size:.77rem}
.roster-list{list-style:none;padding:0;margin:0}.roster-list li+li{border-top:1px solid var(--border)}
.roster-row,.roster-person,.roster-tools,.roster-actions{display:flex;align-items:center}
.roster-row{justify-content:space-between;gap:.5rem;padding:.55rem 0;flex-wrap:wrap}
.roster-person{flex:1 1 9rem;min-width:0;gap:.25rem .65rem;flex-wrap:wrap}
.roster-tools{margin-left:auto;gap:.25rem}.roster-tools button{min-height:2.25rem;min-width:2.25rem}
.roster-role{font-size:.73rem;color:#f0b17f}
.roster-form{display:grid;gap:.8rem}.roster-form label,.roster-form p{font-size:.85rem}.roster-form p{margin:0;color:var(--muted)}
.roster-form p[role="alert"]{color:#f1a19b}.roster-actions{gap:.5rem;flex-wrap:wrap;justify-content:flex-end}
</style>
