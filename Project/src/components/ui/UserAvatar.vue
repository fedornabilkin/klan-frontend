<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { UserIdentity } from '@shared/contracts';
import { userPath } from '@shared/user-links';
import { displayProfileName } from '@/domain/profile-identity';
import { userPresence } from '@/services/realtime';
import Avatar from './Avatar.vue';
import Icon from './Icon.vue';

const props = withDefaults(defineProps<{
  user: UserIdentity & { activeTeams?: readonly unknown[] };
  size?: 'sm' | 'md' | 'lg';
  embedded?: boolean;
}>(), { size: 'sm' });
const inTeam = computed(() => props.user.hasActiveTeam ?? !!props.user.activeTeams?.length);
const presence = computed(() => userPresence(props.user.id));
const presenceLabels = { online: 'Онлайн', offline: 'Офлайн', unknown: 'Статус подключения неизвестен' };
const statusHint = computed(() => [inTeam.value && 'В активной команде', presenceLabels[presence.value]].filter(Boolean).join(' · '));
const name = computed(() => displayProfileName(props.user));
</script>

<template>
  <component :is="embedded ? 'span' : RouterLink" :data-tooltip="embedded ? undefined : statusHint" class="user-avatar" :to="embedded ? undefined : userPath(user)">
    <span class="user-avatar-picture" :class="'picture-' + size">
      <Avatar :user="user" :size="size" />
      <span v-if="inTeam" class="user-avatar-team" role="img" aria-label="В активной команде"
        data-tooltip="В активной команде" data-tooltip-detail><Icon name="users" /></span>
      <span class="user-avatar-presence" :class="presence" role="img"
        :aria-label="presenceLabels[presence]" :data-tooltip="presenceLabels[presence]" data-tooltip-detail />
    </span>
    <span class="user-avatar-copy">
      <span class="user-avatar-name">{{ name }}</span>
      <span v-if="user.callsign" class="user-avatar-callsign">{{ user.callsign }}</span>
      <slot />
    </span>
  </component>
</template>

<style scoped>
.user-avatar{display:inline-flex;align-items:center;gap:.65rem;min-width:0;max-width:100%;color:inherit;text-decoration:none;vertical-align:middle}
a.user-avatar:hover .user-avatar-name{color:var(--accent)}
.user-avatar-copy{display:flex;flex-direction:column;min-width:0;gap:.12rem;line-height:1.35;text-align:start}
.user-avatar-name{font-weight:700;overflow-wrap:anywhere}
.user-avatar-picture{position:relative;display:inline-flex;flex:none;--team-size:.83rem;--dot-size:.52rem}
.picture-md{--team-size:.98rem;--dot-size:.62rem}.picture-lg{--team-size:1.3rem;--dot-size:.82rem}
.user-avatar-team,.user-avatar-presence{position:absolute;box-sizing:border-box;border-radius:50%;box-shadow:0 0 0 1.5px var(--surface,#191b19)}
.user-avatar-team{top:9%;left:9%;transform:translate(-50%,-50%);width:var(--team-size);height:var(--team-size);display:grid;place-items:center;background:#3c2c20;color:#ffb575}
.user-avatar-team :deep(svg){width:65%;height:65%}
.user-avatar-presence{right:10%;bottom:10%;transform:translate(50%,50%);width:var(--dot-size);height:var(--dot-size);background:#838784}
.user-avatar-presence.online{background:#77d79a}.user-avatar-presence.unknown{background:#242724;border:1.5px solid #939992}
.user-avatar-callsign{font-size:.78em;color:#b5ada5;font-weight:500;overflow-wrap:anywhere}
</style>
