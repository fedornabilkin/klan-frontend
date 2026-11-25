<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NSkeleton, useDialog, useMessage } from 'naive-ui';
import { sessionsService, type ActiveSession, type SessionList } from '@/services/sessions';
import { errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import Icon from '@/components/ui/Icon.vue';

const auth = useAuthStore();
const router = useRouter();
const dialog = useDialog();
const messages = useMessage();
const list = ref<SessionList>();
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const locked = computed(() => !!list.value && Date.parse(list.value.revokeOthersAfter) > Date.parse(list.value.serverTime));
const others = computed(() => list.value?.items.some(session => !session.current));
const dates = new Intl.DateTimeFormat('ru-RU', { dateStyle:'medium', timeStyle:'short' });
const unlockDate = new Intl.DateTimeFormat('ru-RU', { dateStyle:'medium', timeStyle:'medium' });
const dateLabel = (date: string | null) => date ? dates.format(new Date(date)) : 'Нет данных';
const device = (session: ActiveSession) => [session.browser || 'Браузер неизвестен', session.os || 'ОС неизвестна'].join(' · ');
let pending: AbortController | undefined;
let unlockTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

async function load() {
  if (disposed) return;
  pending?.abort();
  clearTimeout(unlockTimer);
  const request = new AbortController();
  pending = request;
  loading.value = true;
  error.value = '';
  try {
    const result = await sessionsService.list(request.signal);
    if (request.signal.aborted) return;
    list.value = result;
    const remaining = Date.parse(result.revokeOthersAfter) - Date.parse(result.serverTime);
    if (remaining > 0) unlockTimer = setTimeout(load, remaining + 100);
  } catch (cause) {
    if (!request.signal.aborted) error.value = errorMessage(cause);
  } finally {
    if (!request.signal.aborted) loading.value = false;
  }
}

function confirmEnd(target: ActiveSession | 'others') {
  if (saving.value || (locked.value && (target === 'others' || !target.current))) return;
  const current = target !== 'others' && target.current;
  const title = target === 'others' ? 'Завершить все остальные сессии?' : current ? 'Выйти на этом устройстве?' : 'Завершить сессию?';
  const content = target === 'others' ? 'Вы останетесь в этом браузере. В остальных потребуется повторный вход.'
    : device(target) + '. Для доступа к Клану в этом браузере потребуется снова войти.';
  dialog.warning({ title, content, negativeText:'Отмена', positiveText:current ? 'Выйти' : 'Завершить',
    positiveButtonProps:{type:'error'}, onPositiveClick:async () => {
      if (disposed || saving.value) return;
      saving.value = true;
      try {
        if (current) {
          await auth.logout();
          await router.replace({name:'login'});
        } else {
          await sessionsService.revoke(target === 'others' ? 'others' : target.id);
          messages.success(target === 'others' ? 'Остальные сессии завершены' : 'Сессия завершена');
          await load();
        }
      } catch (cause) {
        messages.error(errorMessage(cause));
        await load();
      } finally { saving.value = false; }
    },
  });
}
function refreshVisible() {
  if (document.visibilityState === 'visible' && !saving.value) void load();
}
onMounted(() => { void load(); document.addEventListener('visibilitychange', refreshVisible); });
onScopeDispose(() => {
  disposed = true;
  pending?.abort();
  clearTimeout(unlockTimer);
  document.removeEventListener('visibilitychange', refreshVisible);
});
</script>

<template lang="pug">
section.detail-panel.profile-sessions(aria-labelledby="sessions-heading")
  .sessions-head
    h2#sessions-heading
      Icon(name="shield-halved")
      | Активные сессии
    NButton(v-if="others" size="small" secondary type="error" :disabled="locked || saving || loading" @click="confirmEnd('others')") Завершить все остальные
  NAlert(v-if="error" type="error" role="alert")
    | {{ error }}
    NButton(size="small" text @click="load") Повторить
  NSkeleton(v-if="loading && !list" height="5rem" :sharp="false")
  template(v-if="list")
    p.cooldown(v-if="locked")
      Icon(name="lock")
      span Другие сессии можно завершить с {{ unlockDate.format(new Date(list.revokeOthersAfter)) }}. {{ list.items.find(item => item.current)?.createdAt ? 'Первые 24 часа после входа действует защита аккаунта.' : 'Для ранее открытой сессии защита действует сутки с первого обращения после обновления.' }}
    ul.sessions-list
      li(v-for="session in list.items" :key="session.id")
        .session-head
          strong {{ device(session) }}
          span.current(v-if="session.current") Текущая сессия
        dl
          div
            dt IP при входе
            dd {{ session.ip || 'Нет данных' }}
          div
            dt Время входа
            dd {{ dateLabel(session.createdAt) }}
          div
            dt Последняя активность
            dd {{ dateLabel(session.lastActiveAt) }}
        NButton(size="small" secondary :disabled="saving || loading || (!session.current && locked)" @click="confirmEnd(session)") {{ session.current ? 'Выйти здесь' : 'Завершить сессию' }}
</template>

<style scoped>
.sessions-head,.session-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.65rem }
.sessions-head h2 { margin:0; display:flex; align-items:center; gap:.55rem; font-size:1rem }
.sessions-head h2 svg { color:#d88d52 }
.cooldown { display:flex; gap:.6rem; align-items:baseline; margin:.85rem 0 0; color:#c9b59d; font-size:.8rem; line-height:1.55 }
.sessions-list { list-style:none; margin:.8rem 0 0; padding:0 }
.sessions-list li { border-top:1px solid #ffffff15; padding:1rem 0 }
.sessions-list li:last-child { padding-bottom:0 }
.session-head { justify-content:flex-start; font-size:.9rem }
.current { font-size:.72rem; border-radius:.4rem; background:#24362a; color:#b8d9bc; padding:.2rem .5rem }
dl { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr)); gap:.6rem 1rem; margin:.75rem 0; font-size:.8rem }
dt { color:var(--muted,#a49a90); margin-bottom:.2rem }
dd { margin:0; overflow-wrap:anywhere; font-variant-numeric:tabular-nums }
</style>
