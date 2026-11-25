<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NAlert, NButton, NCheckbox, NInput, NSkeleton, useMessage } from 'naive-ui';
import type { UserIdentity } from '@shared/contracts';
import PageHeader from '@/components/ui/PageHeader.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { useFilterDelay, searchTerm } from '@/composables/useFilterDelay';
import { ApiError, errorMessage } from '@/services/api';
import { accessSettings, type AccessGroup, type AccessSettings } from '@/services/accessSettings';
import { communityService } from '@/services/community';

const messages = useMessage();
const saved = ref<AccessSettings>();
const admins = ref<UserIdentity[]>([]);
const groups = ref<AccessGroup[]>([]);
const membersOnly = ref(false);
const address = ref('');
const query = ref('');
const page = ref(1);
const pages = ref(0);
const candidates = ref<UserIdentity[]>([]);
const matches = computed(() => candidates.value.filter(user => !admins.value.some(admin => admin.id === user.id)));
const busy = ref(false);
const searching = ref(false);
const error = ref('');
const searchError = ref('');
const chatError = ref('');
const conflict = ref(false);
const dirty = computed(() => saved.value && (membersOnly.value !== saved.value.membersOnly ||
  JSON.stringify(admins.value.map(user => user.id)) !== JSON.stringify(saved.value.admins.map(user => user.id)) ||
  JSON.stringify(groups.value) !== JSON.stringify(saved.value.groups)));
const delay = useFilterDelay();

watch(query, () => { page.value = 1; });
watch([query, page], ([text, currentPage], _previous, onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => { delay.cancel(); controller.abort(); });
  candidates.value = [];
  pages.value = 0;
  searchError.value = '';
  const q = searchTerm(text);
  searching.value = !!q;
  if (!q) return;
  delay.schedule(async () => {
    try {
      const response = await communityService.list('users', {q, sort:'name', page:currentPage, limit:20, view:'cards'}, controller.signal);
      if (!controller.signal.aborted) {
        candidates.value = response.data.filter(user => 'name' in user);
        pages.value = response.meta.pages;
      }
    } catch (cause) {
      if (!controller.signal.aborted) searchError.value = errorMessage(cause);
    } finally {
      if (!controller.signal.aborted) searching.value = false;
    }
  });
});

function apply(settings: AccessSettings) {
  saved.value = settings;
  admins.value = [...settings.admins];
  groups.value = [...settings.groups];
  membersOnly.value = settings.membersOnly;
  conflict.value = false;
}
async function load() {
  busy.value = true;
  error.value = '';
  try { apply(await accessSettings.load()); }
  catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function addGroup() {
  if (!address.value.trim() || busy.value) return;
  busy.value = true;
  chatError.value = '';
  try {
    const chat = await accessSettings.resolve(address.value.trim());
    if (groups.value.some(group => group.id === chat.id)) { chatError.value = 'Это сообщество уже в списке.'; return; }
    groups.value.push(chat);
    membersOnly.value = true;
    address.value = '';
  } catch (cause) { chatError.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function save() {
  if (!saved.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    apply(await accessSettings.save(saved.value.revision, membersOnly.value, admins.value, groups.value));
    messages.success('Настройки доступа сохранены');
  } catch (cause) {
    error.value = errorMessage(cause);
    conflict.value = cause instanceof ApiError && cause.status === 409;
  } finally { busy.value = false; }
}
onMounted(load);
</script>

<template lang="pug">
PageHeader(title="Постоянный доступ" eyebrow="Управление")
NAlert.notice(v-if="error" type="error" role="alert")
  | {{ error }}
  NButton(v-if="conflict || !saved" size="small" :disabled="busy" @click="load") Загрузить настройки
NSkeleton(v-if="!saved && busy" height="8rem")
template(v-if="saved")
  .access-grid
    section.access-card
      h2 Администраторы
      p После подтверждения в Telegram выбранные участники могут управлять сайтом, даже если выйдут из всех групп и каналов.
      label(for="access-user") Добавить администратора
      NInput(v-model:value="query" :input-props="{id:'access-user'}" placeholder="Имя, фамилия или позывной · от 3 символов" clearable :disabled="busy")
      .search-results(v-if="searchTerm(query)" aria-live="polite")
        small(v-if="searchError") {{ searchError }}
        small(v-else-if="searching") Ищем участников…
        small(v-else-if="!matches.length") Нет подходящих участников для добавления
        .access-row(v-for="user in matches" :key="user.id")
          UserAvatar(:user="user")
          NButton(size="small" :disabled="busy" :aria-label="'Назначить администратором: ' + user.name" @click="admins.push(user); query = ''") Добавить
        .access-row(v-if="pages > 1")
          NButton(size="small" :disabled="busy || page === 1" @click="page--") Назад
          span {{ page }} / {{ pages }}
          NButton(size="small" :disabled="busy || page >= pages" @click="page++") Дальше
      ul.entries(v-if="admins.length" aria-label="Постоянные администраторы")
        li.access-row(v-for="user in admins" :key="user.id")
          UserAvatar(:user="user")
          NButton(size="small" :disabled="busy" :aria-label="'Убрать из администраторов: ' + user.name" @click="admins = admins.filter(item => item.id !== user.id)") Убрать
      p.empty(v-else) Постоянные администраторы пока не выбраны.
    section.access-card
      h2 Группы и каналы Telegram
      p Для входа достаточно состоять в одном сообществе из списка. Назначьте бота Клана администратором каждого сообщества.
      label(for="access-chat") Добавить сообщество
      form.chat-input(@submit.prevent="addGroup")
        NInput(v-model:value="address" :input-props="{id:'access-chat'}" placeholder="@имя, ссылка t.me или числовой ID" :disabled="busy" @update:value="chatError = ''")
        NButton(attr-type="submit" :disabled="busy || !address.trim()") Добавить
      small(v-if="chatError" role="alert") {{ chatError }}
      ul.entries(v-if="groups.length" aria-label="Разрешённые сообщества")
        li.access-row(v-for="group in groups" :key="group.id")
          span.chat-name {{ group.title }}
            small(v-if="group.title !== group.id") {{ group.id }}
          NButton(size="small" :disabled="busy" :aria-label="'Убрать сообщество ' + group.title" @click="groups = groups.filter(item => item.id !== group.id)") Убрать
      template(v-else)
        p.empty Список сообществ пуст.
        NCheckbox(:checked="!membersOnly" :disabled="busy" @update:checked="membersOnly = !$event") Разрешить вход всем, кто подтвердил аккаунт в Telegram
        p(v-if="membersOnly") Сейчас войти смогут только постоянные администраторы.
  .save-row
    NButton(type="primary" :disabled="busy || !dirty || conflict || !!address.trim()" @click="save") Сохранить настройки
</template>

<style scoped>
.access-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:1rem }
.access-card { min-width:0; padding:clamp(1rem,3vw,1.5rem); border:1px solid var(--border,#333733); background:var(--surface,#191b19); border-radius:1rem }
h2 { margin:0; font-size:1.15rem }
p,small { color:var(--muted,#a4aa9f); line-height:1.55 }
p { margin:.55rem 0 1rem }
label { display:block; font-weight:650; margin-bottom:.45rem }
.chat-input,.access-row,.save-row { display:flex; gap:.65rem; align-items:center }
.access-row { justify-content:space-between; padding:.65rem 0; border-bottom:1px solid #ffffff12 }
.entries { list-style:none; padding:0; margin:.75rem 0 0 }
.chat-name { min-width:0; overflow-wrap:anywhere }
.chat-name small { display:block }
.search-results { max-height:16rem; overflow-y:auto; padding:.5rem .25rem }
.empty { font-size:.88rem; margin:1rem 0 .4rem }
.save-row { margin-top:1.25rem }
.notice { margin-bottom:1rem }
@media(max-width:760px) { .access-grid { grid-template-columns:minmax(0,1fr) } }
</style>
