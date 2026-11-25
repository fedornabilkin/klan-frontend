<script setup lang="ts">
import { ref,watch } from 'vue';
import { NButton,NForm,NFormItem,NModal } from 'naive-ui';
import type { Entity } from '@shared/contracts';
import NumberField from '@/components/ui/NumberField.vue';
import { communityService } from '@/services/community';
import { resultInputLimits, type resultPeriod, type SavedChallengeDay } from '@/domain/challengeResults';
import { useAuthStore } from '@/stores/auth';
const props = defineProps<{show:boolean; entity:Entity; period:ReturnType<typeof resultPeriod>}>();
const emit = defineEmits<{'update:show':[value:boolean]; saved:[id:string, day:SavedChallengeDay]}>();
const auth = useAuthStore();
const date = ref(''), value = ref<number|null>(0), busy = ref(false), error = ref('');
function restore() {
  value.value = (props.entity.results ?? []).reduce((sum, row) =>
    row.user.id === auth.user?.id && row.date === date.value ? sum + row.value : sum, 0);
}
watch(() => props.show, show => { if (show) { date.value = props.period.last; restore(); error.value = ''; } });
watch(date, restore);
async function save() {
  if (busy.value || !props.period.open) return;
  if (value.value === null || !date.value) { error.value='Укажите дату и результат'; return; }
  const id = props.entity.id;
  busy.value = true; error.value = '';
  try {
    const day = await communityService.saveChallengeDay(id, {date:date.value, value:value.value});
    emit('saved', id, day);
    emit('update:show', false);
  } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось сохранить результат'; }
  finally { busy.value = false; }
}
</script>
<template lang="pug">
NModal(:show="show" preset="card" title="Мой результат" :style="{width:'28rem',maxWidth:'calc(100vw - 2rem)'}" @update:show="emit('update:show',$event)")
  NForm(label-placement="top" @submit.prevent="save")
    .result-fields
      NFormItem(label="За какую дату")
        input.result-date(v-model="date" type="date" :min="period.first" :max="period.last" :disabled="busy" required)
      NFormItem(:label="`Результат · ${entity.goal?.unit || 'ед.'}`")
        NumberField(v-model="value" required aria-label="Результат" :disabled="busy" v-bind="resultInputLimits(entity.category)")
    p.modal-intro(v-if="entity.category === 'attendance'") 1 — был на мероприятии, 0 — не участвовал.
    p.modal-intro Можно изменить результат за прошедший день до завершения челленджа. Новое значение заменит предыдущее за эту дату.
    p.modal-error(v-if="error" role="alert") {{ error }}
    .modal-actions
      NButton(@click="emit('update:show',false)") Отмена
      NButton(type="primary" attr-type="submit" :disabled="!period.open" :loading="busy") Сохранить
</template>
<style scoped>
.result-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.result-fields :deep(.n-form-item){min-width:0}@media(max-width:35rem){.result-fields{grid-template-columns:1fr;gap:0}}
.result-date{display:block;width:100%;background:#252323;border:1px solid #484039;border-radius:.4rem;color:#eee3da;color-scheme:dark;padding:.65rem;font:inherit;box-sizing:border-box}.modal-intro{font-size:.8rem;line-height:1.6;color:#a49a93}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem}.modal-error{color:#f2a19b;font-size:.8rem}
</style>
