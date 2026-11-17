<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { ApiResponse, Tag } from '@shared/contracts';
import { api } from '@/services/api';
import Icon from '@/components/ui/Icon.vue';
const props = defineProps<{ modelValue: Tag[] }>();
const emit = defineEmits<{ 'update:modelValue': [tags: Tag[]] }>();
const query = ref(''); const available = ref<Tag[]>([]); const busy = ref(false); const error = ref('');
const suggestions = computed(() => available.value.filter(t => !props.modelValue.some(s => s.id === t.id) && t.name.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))).slice(0, 8));
const canCreate = computed(() => props.modelValue.length < 30 && query.value.trim().length > 1 && !available.value.some(t => t.name.toLocaleLowerCase('ru') === query.value.trim().toLocaleLowerCase('ru')));
function select(tag: Tag) { if(props.modelValue.length>=30){error.value='Можно выбрать не более 30 тегов.';return;} error.value='';emit('update:modelValue', [...props.modelValue, tag]); query.value=''; }
async function create() { if(!canCreate.value || busy.value) return; busy.value=true; error.value=''; try { const result=await api.post<ApiResponse<Tag>>('/tags',{name:query.value.trim()}); available.value.push(result.data); select(result.data); } catch(e) {error.value=e instanceof Error?e.message:'Не удалось создать тег';} finally{busy.value=false;} }
onMounted(async()=>{try{available.value=(await api.get<ApiResponse<Tag[]>>('/tags')).data;}catch(e){error.value=e instanceof Error?e.message:'Теги недоступны';}});
</script>
<template lang="pug">
.tag-picker
  .selected-tags(v-if="modelValue.length")
    button(v-for="tag in modelValue" :key="tag.id" type="button" :aria-label="`Убрать тег ${tag.name}`" @click="emit('update:modelValue', modelValue.filter(t => t.id !== tag.id))")
      | {{ tag.name }}
      Icon(name="xmark")
  .tag-query
    NInput(v-model:value="query" placeholder="Найти или создать интерес…" maxlength="50" @keydown.enter.prevent="create")
      template(#prefix)
        Icon(name="magnifying-glass")
    NButton(v-if="canCreate" :loading="busy" @click="create") Создать
  .tag-suggestions(v-if="suggestions.length")
    button(v-for="tag in suggestions" :key="tag.id" type="button" @click="select(tag)")
      Icon(name="plus")
      | {{ tag.name }}
  p.tag-hint(v-if="canCreate") Такого тега пока нет. Создайте его для всего сообщества.
  p.modal-error(v-if="error" role="alert") {{ error }}
</template>
<style scoped>
.selected-tags,.tag-suggestions{display:flex;gap:.4rem;flex-wrap:wrap}.selected-tags{margin-bottom:.7rem}.selected-tags button,.tag-suggestions button{font:inherit;font-size:.75rem;display:flex;align-items:center;gap:.5rem;cursor:pointer;border-radius:.4rem;padding:.4rem .6rem;border:1px solid #624129;color:#f1aa72;background:#33251c}.tag-suggestions{margin-top:.6rem}.tag-suggestions button{background:#252323;border-color:#3a3633;color:#afa39a}.tag-query{display:flex;gap:.5rem}.tag-hint{font-size:.7rem;color:#8e8782}.modal-error{color:#f2a19b;font-size:.8rem}
</style>
