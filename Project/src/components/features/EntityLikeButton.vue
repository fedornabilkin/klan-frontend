<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Entity, LikeSummary } from '@shared/contracts';
import Icon from '@/components/ui/Icon.vue';
import { errorMessage } from '@/services/api';
import { communityService } from '@/services/community';

const props = defineProps<{ entity: Pick<Entity, 'id' | 'type'>; summary: LikeSummary }>();
const current = ref(props.summary);
const busy = ref(false);
const error = ref('');
let version = 0;
watch([() => props.entity.type, () => props.entity.id], () => {
  version++;
  current.value = props.summary;
  busy.value = false;
  error.value = '';
});
watch(() => props.summary, summary => { current.value = summary; });
async function toggle() {
  if (busy.value) return;
  const targetVersion = version;
  busy.value = true;
  error.value = '';
  try {
    const summary = await communityService.setEntityLike(props.entity, !current.value.liked);
    if (version === targetVersion) current.value = summary;
  } catch (cause) { if (version === targetVersion) error.value = errorMessage(cause); }
  finally { if (version === targetVersion) busy.value = false; }
}
</script>

<template lang="pug">
.entity-like
  button.like-button(type="button" :disabled="busy" :aria-busy="busy" :aria-pressed="current.liked" :aria-label="`Нравится: ${current.count}`" :data-tooltip="current.liked ? 'Убрать лайк' : 'Нравится'" @click="toggle")
    Icon(name="thumbs-up")
    span {{ current.count }}
  small(v-if="error" role="alert") {{ error }}
</template>

<style scoped>
.entity-like{position:relative;display:inline-flex;align-items:center;flex-wrap:wrap;gap:.5rem}
.like-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.75rem;min-width:3.75rem;padding:0 .7rem;border:1px solid var(--border);border-radius:.6rem;background:var(--surface);color:inherit;font:inherit;font-size:.82rem;cursor:pointer}
.like-button:hover,.like-button[aria-pressed=true]{color:var(--accent);border-color:var(--accent)}
.like-button:disabled{cursor:wait}.entity-like small{color:#f2a19b;font-size:.75rem}
</style>
