<script setup lang="ts">
import { ref,watch } from 'vue';
import { NButton,NModal,NRadioButton,NRadioGroup,NSelect } from 'naive-ui';
import type { Entity,ListResponse } from '@shared/contracts';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
const props=defineProps<{show:boolean;entity:Entity}>();const emit=defineEmits<{'update:show':[value:boolean];saved:[]}>();const auth=useAuthStore();
const mode=ref<'solo'|'team'>('solo');const teamId=ref<string|null>(null);const teams=ref<{label:string;value:string}[]>([]);const error=ref('');const busy=ref(false);
watch(()=>props.show,async(show)=>{if(!show)return;mode.value='solo';error.value='';try{const result=await api.get<ListResponse<Entity>>('/teams',{limit:100,status:'active'});teams.value=result.data.filter(t=>t.participants.some(p=>p.user.id===auth.user?.id)).map(t=>({label:t.title,value:t.id}));teamId.value=teams.value[0]?.value||null;}catch(e){error.value=e instanceof Error?e.message:'Не удалось загрузить команды';}});
async function join(){busy.value=true;error.value='';try{await api.post(`/challenges/${props.entity.id}/join`,mode.value==='team'?{teamId:teamId.value}:{});emit('saved');emit('update:show',false);}catch(e){error.value=e instanceof Error?e.message:'Не удалось присоединиться';}finally{busy.value=false;}}
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Принять вызов" :style="{width:'29rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="emit('update:show',$event)")
  p {{ entity.title }}
  NRadioGroup(v-model:value="mode" name="participation" size="large")
    NRadioButton(value="solo") Самостоятельно
    NRadioButton(value="team" :disabled="!teams.length") За команду
  .team-select(v-if="mode === 'team'")
    NSelect(v-model:value="teamId" :options="teams" placeholder="Выберите команду")
  p.modal-intro(v-if="!teams.length") Чтобы участвовать за команду, сначала вступите в активную команду.
  p.modal-intro(v-else) Личные результаты останутся вашими. В командном режиме они также пойдут в общий зачёт.
  p.modal-error(v-if="error" role="alert") {{ error }}
  .modal-actions
    NButton(@click="emit('update:show',false)") Отмена
    NButton(type="primary" :loading="busy" :disabled="mode === 'team' && !teamId" @click="join") Участвовать
</template>
<style scoped>
.team-select{margin-top:1rem}.modal-intro{color:#a49a93;font-size:.8rem;line-height:1.6;margin-top:1rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem}.modal-error{color:#f2a19b;font-size:.8rem}
</style>
