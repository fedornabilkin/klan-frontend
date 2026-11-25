<script setup lang="ts">
import { computed } from 'vue';
import { feedbackStatuses } from '@/domain/entityStatus';

const props = defineProps<{ status: string; busy?: boolean; showCurrent?: boolean }>();
const emit = defineEmits<{ select: [status: string] }>();
const choices = computed(() => feedbackStatuses.filter(choice => props.showCurrent || choice.value !== props.status));
</script>

<template lang="pug">
.feedback-status-buttons(role="group" aria-label="Изменить статус заявки" :aria-busy="busy")
  button(v-for="choice in choices" :key="choice.value" type="button" :value="choice.value" :disabled="busy" :aria-pressed="showCurrent ? choice.value === status : undefined" @click="emit('select', choice.value)") {{ choice.label }}
</template>

<style scoped>
.feedback-status-buttons { display: flex; flex-wrap: wrap; gap: .4rem; }
button { padding: .35rem .7rem; min-height: 2.4rem; border: 1px solid var(--border); border-radius: .5rem; background: var(--surface); color: inherit; font: inherit; font-size: .8rem; cursor: pointer; }
button:hover, button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button:disabled { opacity: .65; cursor: wait; }
</style>
