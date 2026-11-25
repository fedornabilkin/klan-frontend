<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ApiResponse, Entity, LikeSummary } from '@shared/contracts';
import Icon from '@/components/ui/Icon.vue';
import { buildLikeSummary } from '@/domain/builders';
import { api, errorMessage } from '@/services/api';

const props = defineProps<{ entity: Pick<Entity, 'id' | 'type'>; summary: LikeSummary }>();
const current = ref(props.summary);
const busy = ref(false);
const error = ref('');
watch(() => props.summary, summary => { current.value = summary; });
async function toggle() {
  if (busy.value) return;
  const {id, type} = props.entity;
  busy.value = true;
  error.value = '';
  try {
    const {data} = await api.put<ApiResponse<LikeSummary>>(`/${type}/${encodeURIComponent(id)}/like`, {liked: !current.value.liked});
    if (props.entity.id === id) current.value = buildLikeSummary(data);
  } catch (cause) { if (props.entity.id === id) error.value = errorMessage(cause); }
  finally { busy.value = false; }
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
