<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton,NInput,NInputNumber,NModal,NSelect } from 'naive-ui';
import type { ApiResponse,Entity,Item } from '@shared/contracts';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import Icon from '@/components/ui/Icon.vue';
const props=defineProps<{show:boolean;entity:Entity}>();const emit=defineEmits<{'update:show':[value:boolean];saved:[]}>();
const auth=useAuthStore();const catalog=ref<Item[]>([]);const selected=ref<Item[]>([]);const newName=ref('');const selectedId=ref<string|null>(null);const error=ref('');const busy=ref(false);
const options=computed(()=>catalog.value.filter(i=>!selected.value.some(s=>s.id===i.id)).map(i=>({label:i.name,value:i.id})));
watch(()=>props.show,async(show)=>{if(!show)return;error.value='';selected.value=(props.entity.participants.find(p=>p.user.id===auth.user?.id)?.items||[]).map(i=>({...i,quantity:i.quantity??1}));try{catalog.value=(await api.get<ApiResponse<Item[]>>('/items')).data;}catch(e){error.value=e instanceof Error?e.message:'Не удалось загрузить вещи';}});
function add(id:string|null){const item=catalog.value.find(i=>i.id===id);if(item&&!selected.value.some(i=>i.id===id))selected.value.push({...item,quantity:1});selectedId.value=null;}
async function create(){if(newName.value.trim().length<2)return;busy.value=true;error.value='';try{const item=(await api.post<ApiResponse<Item>>('/items',{name:newName.value.trim()})).data;if(!catalog.value.some(i=>i.id===item.id))catalog.value.push(item);add(item.id);newName.value='';}catch(e){error.value=e instanceof Error?e.message:'Не удалось добавить предмет';}finally{busy.value=false;}}
async function save(){if(selected.value.some(i=>!Number.isInteger(i.quantity)||(i.quantity??0)<1)){error.value='Укажите количество каждого предмета: целое число от 1 до 999.';return;}busy.value=true;error.value='';try{await api.put(`/events/${props.entity.id}/items`,{items:selected.value});emit('saved');emit('update:show',false);}catch(e){error.value=e instanceof Error?e.message:'Не удалось сохранить список';}finally{busy.value=false;}}
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Что я возьму с собой" :style="{width:'34rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="emit('update:show',$event)")
  p.modal-intro Ваш список увидят участники мероприятия. Так проще распределить общее снаряжение.
  NSelect(v-model:value="selectedId" filterable :options="options" placeholder="Выбрать из общего списка" @update:value="add")
  .equipment-list
    .equipment-row(v-for="(item,index) in selected" :key="item.id")
      span {{ item.name }}
      NInputNumber(v-model:value="item.quantity" :min="1" :max="999" :precision="0" size="small")
      NButton(quaternary circle :aria-label="`Убрать ${item.name}`" @click="selected.splice(index,1)")
        template(#icon)
          Icon(name="xmark")
    p.modal-intro(v-if="!selected.length") Пока список пуст. Добавьте первый предмет.
  .create-equipment
    NInput(v-model:value="newName" placeholder="Нет нужного предмета? Введите название" maxlength="80" @keydown.enter.prevent="create")
    NButton(:loading="busy" :disabled="newName.trim().length < 2" @click="create") Добавить
  p.modal-error(v-if="error" role="alert") {{ error }}
  .modal-actions
    NButton(@click="emit('update:show',false)") Отмена
    NButton(type="primary" :loading="busy" @click="save") Сохранить список
</template>
<style scoped>
.modal-intro{font-size:.8rem;line-height:1.6;color:#a49a93}.equipment-list{margin:1rem 0}.equipment-row{display:grid;grid-template-columns:1fr 7rem 2rem;align-items:center;gap:.5rem;padding:.6rem 0;border-bottom:1px solid #ffffff0c;font-size:.85rem}.create-equipment{display:flex;gap:.5rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem}.modal-error{color:#f2a19b;font-size:.8rem}@media(max-width:30rem){.create-equipment{flex-direction:column}.equipment-row{grid-template-columns:1fr 6rem 2rem}}
</style>
