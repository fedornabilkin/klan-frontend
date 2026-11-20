<script setup lang="ts">
import { NModal } from 'naive-ui';
import type { User } from '@shared/contracts';
import UserAvatar from '@/components/ui/UserAvatar.vue';
defineProps<{show:boolean;readers:User[]}>();const emit=defineEmits<{'update:show':[value:boolean]}>();
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Уже прочитали" :style="{width:'29rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="emit('update:show',$event)")
  .reader-list
    UserAvatar.reader(v-for="user in readers" :key="user.id" :user="user" @click="emit('update:show',false)")
      small(v-if="user.location.city") {{ user.location.city }}
    p(v-if="!readers.length") Станьте первым, кто прочитает эту книгу.
</template>
<style scoped>
.reader-list{display:flex;flex-direction:column;gap:.6rem}.reader{display:flex;gap:.8rem;align-items:center;text-decoration:none;color:inherit;padding:.6rem;border-radius:.5rem}.reader:hover{background:#ffffff08}.reader strong{display:block;font-size:.85rem}.reader small{color:#a49a93;font-size:.7rem}.reader-list>p{color:#a49a93}
</style>
