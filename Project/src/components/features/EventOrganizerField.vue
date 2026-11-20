<script setup lang="ts">
import { computed, h, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { NInput, NSelect } from 'naive-ui';
import type { EventOrganizer, User } from '@shared/contracts';
import { searchTerm, useDebouncedValue } from '@/composables/useFilterDelay';
import { communityService } from '@/services/community';
import { displayProfileName } from '@/domain/profile-identity';
import UserAvatar from '@/components/ui/UserAvatar.vue';

const model = defineModel<EventOrganizer | null>();
const props = defineProps<{ initialUser?: User }>();
const mode = ref<'member' | 'text'>(model.value && 'name' in model.value ? 'text' : 'member');
const selected = shallowRef(props.initialUser);
const rows = shallowRef<User[]>([]);
const open = ref(false), query = ref(''), loading = ref(false), error = ref('');
const term = useDebouncedValue(() => searchTerm(query.value));
const memberId = computed(() => model.value && 'userId' in model.value ? model.value.userId : null);
const name = computed(() => model.value && 'name' in model.value ? model.value.name : '');
const options = computed(() => {
  const members = [...rows.value];
  if (selected.value && selected.value.id === memberId.value && !members.some(user => user.id === memberId.value)) members.unshift(selected.value);
  return members.map(user => ({ value: user.id, label: displayProfileName(user), user }));
});
let controller: AbortController | undefined;
let page = 0, pages = 1;

function switchMode(next: 'member' | 'text') {
  if (mode.value === next) return;
  mode.value = next;
  model.value = null;
  open.value = false;
  query.value = '';
}
async function fetchPage(next: number) {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  try {
    const result = await communityService.list('users', { view: 'cards', q: term.value, page: next, limit: 30, sort: 'name' }, request.signal);
    if (request.signal.aborted) return;
    const people = result.data.filter(row => 'name' in row);
    rows.value = next === 1 ? people : [...rows.value, ...people];
    page = next;
    pages = result.meta.pages;
  } catch {
    if (!request.signal.aborted) error.value = 'Не удалось загрузить участников.';
  } finally { if (!request.signal.aborted) loading.value = false; }
}
watch([open, term], ([shown]) => {
  controller?.abort();
  rows.value = [];
  page = 0; pages = 1; loading.value = false;
  if (shown) void fetchPage(1);
});
function toggleList(shown: boolean) {
  open.value = shown;
  if (!shown) query.value = '';
}
function more(event: Event) {
  const list = event.target;
  if (list instanceof HTMLElement && !loading.value && page < pages && list.scrollHeight - list.scrollTop - list.clientHeight < 60) void fetchPage(page + 1);
}
function choose(id: string | null) {
  selected.value = options.value.find(option => option.value === id)?.user;
  model.value = id ? { userId: id } : null;
  query.value = '';
}
function renderPerson(option: { user?: unknown; label?: unknown }) {
  return option.user ? h(UserAvatar, { user: option.user as User, embedded: true }) : String(option.label ?? '');
}
onScopeDispose(() => controller?.abort());
</script>

<template>
  <fieldset class="organizer-field">
    <legend>Организатор</legend>
    <div class="organizer-modes">
      <label><input type="radio" :checked="mode === 'member'" @change="switchMode('member')" /> Участник Клана</label>
      <label><input type="radio" :checked="mode === 'text'" @change="switchMode('text')" /> Ввести вручную</label>
    </div>
    <NSelect v-if="mode === 'member'" :value="memberId" :options="options" :render-label="renderPerson" filterable remote clearable
      :loading="loading" :fallback-option="false" placeholder="Выберите участника" aria-label="Организатор из Клана"
      @update:value="choose" @update:show="toggleList" @search="query = $event" @scroll="more">
      <template #empty>{{ loading ? 'Загрузка…' : 'Участники не найдены' }}</template>
    </NSelect>
    <NInput v-else :value="name" :maxlength="120" placeholder="Имя или название организации" aria-label="Имя организатора"
      @update:value="model = $event.trim() ? { name: $event } : null" />
    <p v-if="error && mode === 'member'" role="alert">{{ error }} <button type="button" @click="fetchPage(page + 1)">Повторить</button></p>
  </fieldset>
</template>

<style scoped>
.organizer-field{min-width:0;margin:0 0 1rem;padding:0;border:0}.organizer-field legend{padding:0;font-size:.87rem}.organizer-modes{display:flex;flex-wrap:wrap;gap:.4rem 1rem;margin:.4rem 0 .6rem}.organizer-modes label{display:flex;align-items:center;gap:.3rem;cursor:pointer;color:var(--muted);font-size:.8rem}.organizer-modes input{accent-color:var(--accent)}.organizer-field p{color:#ecaaa0;font-size:.8rem}.organizer-field button{color:inherit;background:transparent;border:0;text-decoration:underline;cursor:pointer}
</style>
