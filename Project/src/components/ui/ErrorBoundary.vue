<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue';
import Icon from './Icon.vue';
const props = defineProps<{resetOn?: string}>();
const failed = ref(false);
watch(() => props.resetOn, () => { failed.value = false; });
const attempt = ref(0);
onErrorCaptured((error) => { console.error('Isolated module error', error); failed.value = true; return false; });
function retry(): void { failed.value = false; attempt.value += 1; }
</script>

<template lang="pug">
.module-error(v-if="failed" role="alert")
  Icon(name="circle-info")
  p Этот блок временно недоступен. Остальные разделы продолжают работать.
  button(type="button" @click="retry") Повторить
template(v-else :key="attempt")
  slot
</template>

<style scoped>
.module-error { padding: 1.5rem; border: 1px solid #8f5c3244; border-radius: .75rem; background: #2f231922; color: #d1a57c; font-size: .85rem; }
button { padding: .6rem 1rem; border: 1px solid #92643e; border-radius: .4rem; background: transparent; color: inherit; cursor: pointer; }
</style>
