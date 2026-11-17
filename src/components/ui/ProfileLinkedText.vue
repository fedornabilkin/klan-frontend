<script setup lang="ts">
import { computed } from 'vue';
import { profileTextParts } from '@/domain/profileLinks';

const props = defineProps<{ text: string; telegramUsername?: string }>();
const parts = computed(() => profileTextParts(props.text, { telegramUsername: props.telegramUsername }));
</script>

<template>
  <span class="profile-linked-text"><template v-for="(part, index) in parts" :key="index"><a v-if="part.href" :href="part.href" :target="part.href.startsWith('mailto:') ? undefined : '_blank'" rel="noopener noreferrer">{{ part.text }}</a><template v-else>{{ part.text }}</template></template></span>
</template>

<style scoped>
.profile-linked-text{white-space:inherit;overflow-wrap:anywhere}.profile-linked-text a{color:#e8ac7e;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.18em}.profile-linked-text a:hover{color:#ffd5b4}.profile-linked-text a:focus-visible{outline:2px solid #ed9857;outline-offset:3px;border-radius:2px}
</style>
