<script setup lang="ts">
import { ref } from 'vue';
import type { Entity } from '@shared/contracts';
import { communityService } from '@/services/community';
import { errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import FeedbackStatusButtons from './FeedbackStatusButtons.vue';

const props = defineProps<{ entity: Entity }>();
const emit = defineEmits<{ statusChanged: [id: string, status: string] }>();
const auth = useAuthStore();
const busy = ref(false);
const error = ref('');
async function changeStatus(status: string) {
  if (!auth.isAdmin || busy.value || status === props.entity.status) return;
  busy.value = true;
  error.value = '';
  const id = props.entity.id;
  try {
    const saved = await communityService.setFeedbackStatus(id, status);
    emit('statusChanged', id, saved);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template lang="pug">
.feedback-actions(v-if="auth.isAdmin")
  FeedbackStatusButtons(:status="entity.status" :busy="busy" @select="changeStatus")
  small(v-if="error" role="alert") {{ error }}
</template>

<style scoped>
.feedback-actions { display: grid; justify-items: end; gap: .4rem; margin-inline-start: auto; }
.feedback-actions :deep(.feedback-status-buttons) { justify-content: flex-end; }
small { color: #f2a19b; }
</style>
