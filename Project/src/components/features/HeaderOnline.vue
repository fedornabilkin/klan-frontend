<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NModal, NButton } from 'naive-ui';
import type { ListResponse, UserIdentity } from '@shared/contracts';
import { api, errorMessage } from '@/services/api';
import { onlineCount, onlineIds } from '@/services/realtime';
import { useRoute } from 'vue-router';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import Pagination from '@/components/ui/Pagination.vue';

const open = ref(false), page = ref(1), loading = ref(false), error = ref('');
const users = ref<UserIdentity[]>([]);
const pageSize = 25;
const pages = computed(() => Math.max(1, Math.ceil((onlineCount.value ?? 0) / pageSize)));
const route = useRoute();
const retry = ref(0);
watch(() => route.path, () => { open.value = false; });
watch(open, () => { page.value = 1; users.value = []; });
watch(pages, count => { if (page.value > count) page.value = count; });
const visibleIds = computed(() => open.value ? onlineIds()?.slice((page.value-1)*pageSize,page.value*pageSize).join('|') : undefined);
watch([open, page, visibleIds, retry], ([shown], _, cleanup) => {
  error.value = '';
  if (!shown || !visibleIds.value) { users.value = []; loading.value = false; return; }
  const controller = new AbortController();
  loading.value = true;
  const timer = setTimeout(async () => {
    try {
      const result = await api.get<ListResponse<UserIdentity>>('/presence/users', { page:page.value, limit:pageSize }, controller.signal);
      if (!controller.signal.aborted) users.value = result.data;
    } catch (cause) { if (!controller.signal.aborted) error.value = errorMessage(cause); }
    finally { if (!controller.signal.aborted) loading.value = false; }
  }, 120);
  cleanup(() => { clearTimeout(timer); controller.abort(); });
});
</script>

<template lang="pug">
button.header-online(type="button" aria-haspopup="dialog" :aria-label="onlineCount === null ? 'Статус онлайн неизвестен' : 'Участников онлайн: ' + onlineCount" @click="open = true")
  span.online-dot(:class="{ known:onlineCount !== null }")
  span Онлайн
  b {{ onlineCount ?? '—' }}
NModal(v-model:show="open" preset="card" title="Сейчас онлайн" style="width:min(28rem, calc(100vw - 2rem))")
  p(v-if="onlineCount === null" role="status") Ожидаем соединения…
  p(v-else-if="error" role="alert") {{ error }}
    NButton(size="small" @click="retry++") Повторить
  p(v-else-if="loading" role="status") Загрузка…
  ul.online-list(v-else-if="users.length")
    li(v-for="user in users" :key="user.id")
      UserAvatar(:user="user" @click="open = false")
  p(v-else) Сейчас никого нет онлайн.
  Pagination(:page="page" :pages="pages" @change="page = $event")
</template>

<style scoped>
.header-online{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;min-height:2.5rem;border:1px solid var(--border);border-radius:.5rem;background:transparent;color:var(--text);font:inherit;font-size:.76rem;white-space:nowrap;cursor:pointer}
.header-online:hover{background:var(--surface-raised)}.header-online b{font-variant-numeric:tabular-nums}.online-dot{width:.45rem;height:.45rem;border-radius:50%;background:#929691}.online-dot.known{background:#77d79a}
.online-list{list-style:none;margin:0;padding:.2rem;max-height:55vh;overflow:auto}.online-list li+li{margin-top:.65rem}
</style>
