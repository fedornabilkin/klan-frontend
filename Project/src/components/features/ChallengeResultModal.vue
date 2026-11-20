<script setup lang="ts">
import { computed,ref,watch } from 'vue';
import { NButton,NForm,NFormItem,NModal } from 'naive-ui';
import type { Entity } from '@shared/contracts';
import NumberField from '@/components/ui/NumberField.vue';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
const props=defineProps<{show:boolean;entity:Entity}>();const emit=defineEmits<{'update:show':[value:boolean];saved:[]}>();const auth=useAuthStore();
const today=new Date().toISOString().slice(0,10);const date=ref(today);const value=ref<number|null>(0);const busy=ref(false);const error=ref('');
const minimum=computed(()=>props.entity.schedule?.start.slice(0,10)||'');const maximum=computed(()=>{const end=props.entity.schedule?.end.slice(0,10)||today;return end<today?end:today;});
function restore(){value.value=props.entity.results?.find(r=>r.user.id===auth.user?.id&&r.date.slice(0,10)===date.value)?.value||0;}
watch(()=>props.show,(show)=>{if(show){date.value=maximum.value;restore();error.value='';}});watch(date,restore);
async function save(){if(value.value===null||!date.value){error.value='Укажите дату и результат';return;}busy.value=true;error.value='';try{await api.put(`/challenges/${props.entity.id}/results`,{date:date.value,value:value.value});emit('saved');emit('update:show',false);}catch(e){error.value=e instanceof Error?e.message:'Не удалось сохранить результат';}finally{busy.value=false;}}
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Мой результат" :style="{width:'28rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="emit('update:show',$event)")
  NForm(label-placement="top" @submit.prevent="save")
    NFormItem(label="За какую дату")
      input.result-date(v-model="date" type="date" :min="minimum" :max="maximum" required)
    NFormItem(:label="`Результат · ${entity.goal?.unit || 'ед.'}`")
      NumberField(v-model="value" required aria-label="Результат" :min="0" :max="entity.category === 'attendance' ? 1 : 1000000" :step="entity.category === 'distance' ? 0.01 : 1")
    p.modal-intro(v-if="entity.category === 'attendance'") 1 — был на мероприятии, 0 — не участвовал.
    p.modal-intro Можно изменить результат за прошедший день до завершения челленджа. Новое значение заменит предыдущее за эту дату.
    p.modal-error(v-if="error" role="alert") {{ error }}
    .modal-actions
      NButton(@click="emit('update:show',false)") Отмена
      NButton(type="primary" attr-type="submit" :loading="busy") Сохранить
</template>
<style scoped>
.result-date{display:block;width:100%;background:#252323;border:1px solid #484039;border-radius:.4rem;color:#eee3da;color-scheme:dark;padding:.65rem;font:inherit;box-sizing:border-box}.modal-intro{font-size:.8rem;line-height:1.6;color:#a49a93}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem}.modal-error{color:#f2a19b;font-size:.8rem}
</style>
