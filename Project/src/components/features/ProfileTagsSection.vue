<script setup lang="ts">
import { searchTerm, useDebouncedValue } from '@/composables/useFilterDelay';
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NPopover, NSpin } from 'naive-ui';
import type { ApiResponse, Tag, User } from '@shared/contracts';
import { newTagNameError, normalizeTagName, tagNameKey } from '@shared/tag-names';
import { api } from '@/services/api';
import { communityService } from '@/services/community';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ user: User; editable: boolean }>();
const emit = defineEmits<{ saved: [user: User] }>();
const showPicker = ref(false); const query = ref(''); const catalog = ref<Tag[]>([]);
const loading = ref(false); const busy = ref(false); const error = ref(''); const catalogError = ref('');
const name = computed(() => normalizeTagName(query.value));
const term = useDebouncedValue(() => tagNameKey(searchTerm(query.value)));
const searchKey = computed(() => tagNameKey(query.value));
const selectedKeys = computed(() => new Set(props.user.tags.map(tag => tagNameKey(tag.name))));
const exactTag = computed(() => catalog.value.find(tag => tagNameKey(tag.name) === searchKey.value));
const alreadySelected = computed(() => !!searchKey.value && selectedKeys.value.has(searchKey.value));
const options = computed(() => catalog.value.filter(tag => !selectedKeys.value.has(tagNameKey(tag.name)) && tagNameKey(tag.name).includes(term.value)));
const nameError = computed(() => name.value && !exactTag.value && !alreadySelected.value ? newTagNameError(name.value) : undefined);
const canCreate = computed(() => !!name.value && !loading.value && !catalogError.value && !exactTag.value && !alreadySelected.value && !nameError.value);
watch(() => props.user.id, () => { showPicker.value = false; query.value = ''; error.value = ''; });
watch(() => props.editable, value => { if (!value) showPicker.value = false; });
watch(showPicker, open => { if (open) { query.value = ''; void loadCatalog(); } });
async function loadCatalog() {
  loading.value = true; catalogError.value = '';
  try { catalog.value = await communityService.tags(); }
  catch (cause) { catalogError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить справочник тегов.'; }
  finally { loading.value = false; }
}
async function update(tag: Tag, adding: boolean) {
  if (adding) return addByName(tag.name);
  if (!props.editable || busy.value) return;
  const tags = props.user.tags.filter(item => item.id !== tag.id);
  busy.value = true; error.value = '';
  try {
    const result = await api.patch<ApiResponse<User>>(`/users/${encodeURIComponent(props.user.id)}`, { tags });
    emit('saved', result.data); query.value = '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось изменить теги.'; }
  finally { busy.value = false; }
}
async function addByName(tagName: string) {
  if (!props.editable || busy.value) return;
  if (props.user.tags.length >= 30) { error.value = 'Можно выбрать не более 30 тегов.'; return; }
  const userId = props.user.id;
  busy.value = true; error.value = '';
  try {
    const result = await api.post<ApiResponse<User>>(`/users/${encodeURIComponent(userId)}/tags`, { name: tagName });
    if (props.user.id !== userId) return;
    catalog.value = [...new Map([...catalog.value, ...result.data.tags].map(tag => [tag.id, tag])).values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    emit('saved', result.data); query.value = '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось добавить тег.'; }
  finally { busy.value = false; }
}
function addNewTag() { if (canCreate.value) void addByName(name.value); }
</script>

<template>
  <section class="profile-tags-panel">
    <div class="tags-heading">
      <h2>Теги</h2>
      <NPopover v-if="editable" v-model:show="showPicker" trigger="click" placement="bottom-end" :show-arrow="false" :disabled="busy">
        <template #trigger><NButton secondary circle :disabled="busy || user.tags.length >= 30" aria-label="Добавить тег" :aria-expanded="showPicker"><template #icon><Icon name="plus" /></template></NButton></template>
        <div class="tag-dropdown">
          <NInput v-model:value="query" autofocus clearable placeholder="Найти или добавить тег" :input-props="{ 'aria-label': 'Поиск или добавление тега' }" maxlength="120"><template #prefix><Icon name="magnifying-glass" /></template></NInput>
          <p class="catalog-hint">Тег должен состоять из одного слова. Например: спорт, 3D.</p>
          <div v-if="loading" class="catalog-loading"><NSpin size="small" /><span>Загружаем теги…</span></div>
          <div v-else-if="catalogError" class="catalog-error"><p role="alert">{{ catalogError }}</p><NButton size="small" @click="loadCatalog">Повторить</NButton></div>
          <ul v-else-if="options.length" class="tag-options" aria-label="Существующие теги">
            <li v-for="tag in options" :key="tag.id"><button type="button" :disabled="busy" @click="update(tag, true)"><Icon name="plus" /><span>{{ tag.name }}</span></button></li>
          </ul>
          <p v-else-if="!alreadySelected" class="empty-tags">{{ name ? 'Подходящих тегов нет.' : 'Все доступные теги уже добавлены.' }}</p>
          <template v-if="!loading && !catalogError">
            <p v-if="alreadySelected" class="empty-tags" role="status">Этот тег уже добавлен.</p>
            <p v-else-if="nameError" class="inline-error" role="status">{{ nameError }}</p>
            <NButton v-if="canCreate" class="create-tag" secondary type="primary" :disabled="busy || user.tags.length >= 30" :loading="busy" @click="addNewTag"><template #icon><Icon name="plus" /></template><span>Добавить «{{ name }}»</span></NButton>
          </template>
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <NButton size="small" quaternary :disabled="busy" @click="showPicker = false">Закрыть</NButton>
        </div>
      </NPopover>
    </div>
    <div v-if="user.tags.length" class="selected-tags" :aria-busy="busy">
      <span v-for="tag in user.tags" :key="tag.id" class="profile-tag">
        <RouterLink :to="{ path: '/users', query: { tag: tag.id } }">{{ tag.name }}</RouterLink>
        <button v-if="editable" type="button" :disabled="busy" :aria-label="`Удалить тег ${tag.name}`" @click="update(tag, false)"><Icon name="xmark" /></button>
      </span>
    </div>
    <p v-else class="empty-tags">{{ editable ? 'Добавьте теги, чтобы участникам было проще вас найти.' : 'Теги пока не добавлены.' }}</p>
    <p v-if="busy" class="save-status" role="status">Сохраняем теги…</p>
    <p v-if="error && !showPicker" class="inline-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.tags-heading :deep(.n-button){min-width:2.75rem;min-height:2.75rem}
.create-tag{width:100%;height:auto;min-height:2.75rem;margin:.7rem 0}.create-tag :deep(.n-button__content){white-space:normal;overflow-wrap:anywhere;text-align:left;min-width:0}.create-tag span{min-width:0;overflow-wrap:anywhere}
.profile-tags-panel{min-width:0;border:1px solid #302d29;border-radius:.9rem;padding:1.5rem;background:#1a1919}.tags-heading{display:flex;align-items:center;justify-content:space-between;gap:.7rem;margin-bottom:1rem}.tags-heading h2{font-size:1rem;font-weight:650;margin:0;letter-spacing:-.02em}.selected-tags{display:flex;gap:.5rem;flex-wrap:wrap}.profile-tag{max-width:100%;display:inline-flex;align-items:center;background:#36271d;border:1px solid #5c3c25;color:#e8a571;border-radius:.4rem}.profile-tag a{min-width:0;padding:.5rem .65rem;color:inherit;font-size:.75rem;text-decoration:none;overflow-wrap:anywhere}.profile-tag a:hover{text-decoration:underline}.profile-tag button{display:grid;place-items:center;min-width:2.5rem;min-height:2.5rem;padding:.4rem;border:0;border-left:1px solid #5c3c25;background:transparent;color:#e8a571;cursor:pointer}.profile-tag button:hover{background:#ffffff0a}.profile-tag button:disabled,.tag-options button:disabled{opacity:.5;cursor:wait}.profile-tag button:focus-visible,.tag-options button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.tag-dropdown{width:min(20rem,calc(100vw - 4rem));min-width:0}.tag-options{display:flex;flex-direction:column;gap:.2rem;max-height:16rem;overflow-y:auto;margin:.65rem 0;padding:0;list-style:none}.tag-options button{display:flex;align-items:center;gap:.65rem;width:100%;min-height:2.75rem;padding:.5rem .6rem;border:0;border-radius:.3rem;background:transparent;color:#d3c6bc;text-align:left;font:inherit;font-size:.8rem;cursor:pointer}.tag-options button:hover{background:#ffffff0a}.tag-options button span{overflow-wrap:anywhere}.tag-options svg{flex-shrink:0;color:#db9b69}.empty-tags,.catalog-hint,.save-status{font-size:.76rem;color:#9f948c;line-height:1.6;margin:.5rem 0 0}.catalog-hint{font-size:.68rem;margin:.7rem 0}.catalog-loading{display:flex;align-items:center;gap:.6rem;padding:1rem 0;color:#9f948c;font-size:.75rem}.inline-error,.catalog-error{color:#f2a19b;font-size:.8rem;overflow-wrap:anywhere}.catalog-error p{margin:.7rem 0}.inline-error{margin:.7rem 0 0}@media(max-width:58rem){.profile-tags-panel{padding:1.15rem}}
</style>
