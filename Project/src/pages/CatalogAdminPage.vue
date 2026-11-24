<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NAlert, NButton, NInput, NSelect, NSkeleton } from 'naive-ui';
import type { CatalogKind } from '@shared/catalog';
import type { ListMeta, User } from '@shared/contracts';
import type { CatalogEntryModel } from '@/domain/catalog';
import { catalogService, type CatalogSort } from '@/services/catalog';
import { errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/composables/useRealtime';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import LocationCatalogAdmin from '@/components/features/LocationCatalogAdmin.vue';
import CatalogEntryModal from '@/components/features/CatalogEntryModal.vue';
import CatalogDeleteModal from '@/components/features/CatalogDeleteModal.vue';

import { searchTerm } from '@/composables/useFilterDelay';
import { useQueryFilters } from '@/composables/useQueryFilters';
const applyFilters = useQueryFilters();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canManage = computed(() => auth.isAdmin || Boolean((auth.user as User | null)?.access?.capabilities.includes('catalog.manage')));
type CatalogTab = CatalogKind | 'countries' | 'cities';
const tab = computed<CatalogTab>(() => ['items','countries','cities'].includes(String(route.query.catalog)) ? route.query.catalog as CatalogTab : 'tags');
const geography = computed(() => tab.value === 'countries' || tab.value === 'cities');
const kind = computed<CatalogKind>(() => route.query.catalog === 'items' ? 'items' : 'tags');
const query = computed(() => typeof route.query.q === 'string' ? searchTerm(route.query.q.slice(0, 200)) : '');
const sortOptions = [
  { label: 'Название: А–Я', value: 'name' }, { label: 'Название: Я–А', value: '-name' },
  { label: 'Чаще используются', value: '-usage' }, { label: 'Реже используются', value: 'usage' },
];
const sort = computed<CatalogSort>(() => sortOptions.some(option => option.value === route.query.sort) ? route.query.sort as CatalogSort : 'name');
const page = computed(() => { const value = Number(route.query.page); return Number.isInteger(value) && value > 0 && value <= 100000 ? value : 1; });
const search = ref(query.value);
const entries = ref<CatalogEntryModel[]>([]);
const meta = ref<ListMeta>({ page: 1, pages: 1, limit: 20, total: 0 });
const summary = ref({ entries: 0, used: 0, unused: 0 });
const loading = ref(true);
const error = ref('');
const selected = ref<CatalogEntryModel | null>(null);
const editorOpen = ref(false);
const deleteOpen = ref(false);
let controller: AbortController | undefined;
let realtimeTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function updateQuery(changes: Record<string, string | undefined>): void {
  void router.replace({ query: { ...route.query, ...changes } });
}
function changeCatalog(value: CatalogTab): void {
  void router.push({ query: { catalog: value === 'tags' ? undefined : value } });
}
function changeSort(value: CatalogSort): void { applyFilters({ sort: value === 'name' ? undefined : value, page: undefined }); }
function changePage(value: number): void { updateQuery({ page: value === 1 ? undefined : String(value) }); }
function edit(entry: CatalogEntryModel | null): void { selected.value = entry; editorOpen.value = true; }
function remove(entry: CatalogEntryModel): void { if (entry.canDelete) { selected.value = entry; deleteOpen.value = true; } }
function usageDescription(entry: CatalogEntryModel): string {
  if (!entry.usage.total) return 'Пока не используется';
  return kind.value === 'tags'
    ? `Профили: ${entry.usage.users} · Материалы: ${entry.usage.entities}`
    : `Мероприятия: ${entry.usage.entities} · Списки снаряжения: ${entry.usage.participants}`;
}
async function refresh(): Promise<void> {
  controller?.abort();
  if (!canManage.value || geography.value || disposed) { loading.value = false; return; }
  controller = new AbortController();
  const signal = controller.signal;
  loading.value = true; error.value = '';
  try {
    const result = await catalogService.list(kind.value, { q: query.value, sort: sort.value, page: page.value, limit: 20 }, signal);
    if (signal.aborted || disposed) return;
    entries.value = result.data; meta.value = result.meta; summary.value = result.summary;
    if (page.value > result.meta.pages) changePage(result.meta.pages);
  } catch (cause) { if (!signal.aborted && !disposed) error.value = errorMessage(cause); }
  finally { if (!signal.aborted && !disposed) loading.value = false; }
}
watch(query, value => { if (searchTerm(search.value) !== value) search.value = value; });
watch(search, value => { if (!geography.value) applyFilters({ q: searchTerm(value) || undefined, page: undefined }); });
watch(kind, () => {
  search.value = query.value;
  selected.value = null; editorOpen.value = false; deleteOpen.value = false;
});
watch([tab, query, sort, page, canManage], () => { void refresh(); }, { immediate: true });
useRealtime(message => {
  if (!geography.value && message.type === 'invalidate' && [kind.value, 'catalogs', 'users', 'events', 'teams', 'challenges', 'books', 'news', 'feedback', 'rules', '*'].includes(message.resource) && !realtimeTimer) {
    realtimeTimer = setTimeout(() => { realtimeTimer = undefined; void refresh(); }, 80);
  }
});
onBeforeUnmount(() => { disposed = true; controller?.abort(); if (realtimeTimer) clearTimeout(realtimeTimer); });
</script>

<template lang="pug">
.catalog-page
  PageHeader(title="Справочники" eyebrow="УПРАВЛЕНИЕ СООБЩЕСТВОМ")
  NAlert(v-if="!canManage" type="error" title="Доступ ограничен") Для управления справочниками нужно соответствующее разрешение.
  template(v-else)
    .catalog-switch(role="group" aria-label="Выбор справочника")
      NButton(:type="tab === 'tags' ? 'primary' : 'default'" :aria-pressed="tab === 'tags'" @click="changeCatalog('tags')")
        template(#icon)
          Icon(name="tags")
        | Теги и интересы
      NButton(:type="kind === 'items' ? 'primary' : 'default'" :aria-pressed="tab === 'items'" @click="changeCatalog('items')")
        template(#icon)
          Icon(name="backpack")
        | Предметы и снаряжение
      NButton(v-for="option in [{ value:'countries', title:'Страны' }, { value:'cities', title:'Города' }] as const" :key="option.value" :type="tab === option.value ? 'primary' : 'default'" :aria-pressed="tab === option.value" @click="changeCatalog(option.value)")
        template(#icon)
          Icon(:name="option.value === 'countries' ? 'globe' : 'location-dot'")
        | {{ option.title }}
    LocationCatalogAdmin(v-if="tab === 'countries' || tab === 'cities'" :tab="tab")
    template(v-else)
      .catalog-summary(aria-label="Состояние справочника")
        .catalog-stat
          strong {{ summary.entries }}
          span Всего записей
        .catalog-stat
          strong {{ summary.used }}
          span Используются
        .catalog-stat
          strong {{ summary.unused }}
          span Без связей
      .catalog-toolbar
        NInput(v-model:value="search" placeholder="Поиск по названию (от 3 символов)" aria-label="Поиск в справочнике" clearable :maxlength="200")
          template(#prefix)
            Icon(name="search")
        NSelect.catalog-sort(:value="sort" :options="sortOptions" aria-label="Сортировка справочника" @update:value="changeSort")
        NButton(type="primary" @click="edit(null)")
          template(#icon)
            Icon(name="plus")
          | {{ kind === 'tags' ? 'Создать тег' : 'Создать предмет' }}
      NAlert.catalog-note(type="info" :show-icon="true") Используемую запись нельзя удалить. Сначала снимите её с профилей или материалов. Переименовать можно любую запись.
      NAlert(v-if="error" type="error" :title="error" role="alert")
        NButton(size="small" @click="refresh") Повторить
      .catalog-list(v-else aria-live="polite")
        .catalog-list-head
          span {{ kind === 'tags' ? 'Теги' : 'Предметы' }}
          span Найдено: {{ meta.total }}
        template(v-if="loading")
          NSkeleton(v-for="index in 4" :key="index" height="4.5rem" style="margin: 1rem; width: calc(100% - 2rem)")
        template(v-else-if="entries.length")
          article.catalog-row(v-for="entry in entries" :key="entry.id")
            .catalog-entry-copy
              h2 {{ entry.name }}
              p {{ usageDescription(entry) }}
              small(v-if="!entry.canDelete") Удаление недоступно: запись используется
            .catalog-row-actions
              NButton(secondary circle :aria-label="`Переименовать ${entry.name}`" @click="edit(entry)")
                template(#icon)
                  Icon(name="pen")
              span(:tabindex="entry.canDelete ? undefined : 0" :data-tooltip="entry.canDelete ? 'Удалить запись' : 'Сначала снимите все связи'")
                NButton(secondary circle type="error" :disabled="!entry.canDelete" :aria-label="`Удалить ${entry.name}${entry.canDelete ? '' : ' — запись используется'}`" @click="remove(entry)")
                  template(#icon)
                    Icon(name="trash")
        EmptyState(v-else title="Записи не найдены" description="Измените поиск или создайте новую запись справочника." :icon="kind === 'tags' ? 'tags' : 'backpack'")
      Pagination(v-if="!error && !loading" :page="page" :pages="meta.pages" @change="changePage")
      CatalogEntryModal(v-model:show="editorOpen" :kind="kind" :entry="selected" @saved="refresh")
      CatalogDeleteModal(v-if="selected" v-model:show="deleteOpen" :kind="kind" :entry="selected" @deleted="refresh")
</template>

<style scoped>
.catalog-page { display: grid; gap: 1.25rem; }
.catalog-switch { display: flex; gap: .75rem; flex-wrap: wrap; }
.catalog-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .7rem; }
.catalog-stat { display: grid; gap: .4rem; padding: 1rem; border: 1px solid #ffffff12; border-radius: .75rem; background: #191d19; }
.catalog-stat strong { color: #f1f3ec; font-size: 1.55rem; }
.catalog-stat span { color: #9aa491; font-size: .72rem; }
.catalog-toolbar { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }
.catalog-note { font-size: .8rem; }
.catalog-list { background: #191d19; border: 1px solid #ffffff12; border-radius: .75rem; overflow: hidden; }
.catalog-list-head { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem; color: #9da697; font-size: .75rem; }
.catalog-row { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-top: 1px solid #ffffff0c; }
.catalog-entry-copy { min-width: 0; flex: 1; }
.catalog-entry-copy h2 { color: #edf0e8; overflow-wrap: anywhere; font-size: .95rem; line-height: 1.5; margin: 0 0 .35rem; }
.catalog-entry-copy p { color: #9ba592; font-size: .74rem; margin: 0; line-height: 1.6; }
.catalog-entry-copy small { display: block; margin-top: .3rem; color: #b1a58d; font-size: .66rem; }
.catalog-row-actions { display: flex; gap: .45rem; flex-shrink: 0; }
@media(min-width: 45rem) { .catalog-toolbar { grid-template-columns: minmax(12rem, 1fr) 13rem auto; } .catalog-row, .catalog-list-head { padding: 1rem 1.25rem; } .catalog-summary { max-width: 42rem; } }
</style>
