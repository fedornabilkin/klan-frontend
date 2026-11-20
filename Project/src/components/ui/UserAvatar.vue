<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { UserIdentity } from '@shared/contracts';
import { userPath } from '@shared/user-links';
import { displayProfileName } from '@/domain/profile-identity';
import Avatar from './Avatar.vue';
import Icon from './Icon.vue';

const props = withDefaults(defineProps<{
  user: UserIdentity & { activeTeams?: readonly unknown[] };
  size?: 'sm' | 'md' | 'lg';
  embedded?: boolean;
}>(), { size: 'sm' });
const name = computed(() => displayProfileName(props.user));
</script>

<template>
  <component :is="embedded ? 'span' : RouterLink" class="user-avatar" :to="embedded ? undefined : userPath(user)">
    <Avatar :user="user" :size="size" />
    <span class="user-avatar-copy">
      <span class="user-avatar-name">{{ name }}
        <span v-if="user.hasActiveTeam ?? !!user.activeTeams?.length" class="user-avatar-team" role="img"
          aria-label="В активной команде" title="В активной команде"><Icon name="shield-halved" /></span>
      </span>
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
.user-avatar-team{display:inline-block;color:var(--accent);font-size:.8em;vertical-align:baseline}
.user-avatar-callsign{font-size:.78em;color:#b5ada5;font-weight:500;overflow-wrap:anywhere}
</style>
