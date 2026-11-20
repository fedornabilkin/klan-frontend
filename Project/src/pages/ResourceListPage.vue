<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NInput, NSelect, NSkeleton } from 'naive-ui';
import type { Resource } from '@shared/contracts';
import { useList } from '@/composables/useList';
import { useCommunityTags } from '@/composables/useCommunityTags';
import Icon from '@/components/ui/Icon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import ResourceCard from '@/components/features/ResourceCard.vue';
import CommunityTagFilter from '@/components/features/CommunityTagFilter.vue';
import EntityEditorModal from '@/components/features/EntityEditorModal.vue';
import { resourceMeta } from '@/components/features/resourceMeta';
const route = useRoute();
const resource = computed(() => (route.meta.resource || route.path.split('/')[1]) as Resource);
const meta = computed(() => resourceMeta[resource.value]);
const list = useList(resource, { limit: () => resource.value === 'users' ? 21 : 12 });
const { items, loading, error, filters, page, refresh, setPage } = list;
const pagination = list.meta;
const { ranked: tags, counts: tagCounts, loading: tagsLoading, error: tagsError, refresh: refreshTags } = useCommunityTags(() => ['users','events','challenges','books'].includes(resource.value));
const showEditor = ref(false);
const sortOptions = computed(() => [{ label: 'Сначала новые', value: '-createdAt' }, { label: `${resource.value === 'users' ? 'По имени' : 'По названию'} · А—Я`, value: 'name' }, { label: `${resource.value === 'users' ? 'По имени' : 'По названию'} · Я—А`, value: '-name' }]);
const statuses = computed(() => resource.value === 'feedback' ? [{label:'Все статусы',value:''},{label:'Новые',value:'open'},{label:'В работе',value:'in_progress'},{label:'Решённые',value:'resolved'},{label:'Закрытые',value:'closed'}] : resource.value === 'teams' ? [{label:'Все статусы',value:''},{label:'Активные',value:'active'},{label:'Архив',value:'archived'}] : [{label:'Все статусы',value:''},{label:'Активные',value:'active'},{label:'Скоро',value:'upcoming'},{label:'Завершённые',value:'completed'},{label:'Архив',value:'archived'}]);
const selectedTags = computed({ get: () => (filters.tag || '').split(',').filter(Boolean), set: (value: string[]) => { filters.tag = value.join(','); } });
function toggleTag(id: string) { filters.tag = selectedTags.value.includes(id) ? selectedTags.value.filter(t=>t!==id).join(',') : [...selectedTags.value,id].join(','); }
function clearFilters() { filters.q=''; filters.tag=''; filters.status=''; filters.category=''; filters.city=''; filters.sort='-createdAt'; }
</script>

<template lang="pug">
.feature-page
  .list-page-heading
    PageHeader(:title="meta.title" :description="meta.description" eyebrow="СООБЩЕСТВО KLAN")
    NButton(v-if="resource === 'feedback'" type="primary" @click="showEditor = true")
      template(#icon)
        Icon(name="plus")
      | Предложить идею
    .collection-tools(v-else-if="resource === 'users'")
      .collection-count {{ pagination.total }} в сообществе
      NSelect.list-select(v-model:value="filters.sort" :options="sortOptions" aria-label="Сортировка")
    .collection-count(v-else) {{ pagination.total }} в сообществе
  CommunityTagFilter.member-tag-filter(v-if="resource === 'users'" v-model="selectedTags" v-model:query="filters.q" :tags="tags" :loading="tagsLoading" :error="tagsError" @retry="refreshTags")
  .list-toolbar(v-else)
    NInput.list-search(v-model:value="filters.q" clearable placeholder="Поиск по названию и описанию…" aria-label="Поиск")
      template(#prefix)
        Icon(name="magnifying-glass")
    NSelect.list-select(v-model:value="filters.sort" :options="sortOptions" aria-label="Сортировка")
    NSelect.list-select(v-if="['events','teams','challenges','feedback'].includes(resource)" v-model:value="filters.status" :options="statuses" aria-label="Статус")
    NSelect.list-select(v-if="resource === 'events'" v-model:value="filters.category" :options="[{label:'Любой формат',value:''},{label:'Оффлайн',value:'offline'},{label:'Онлайн',value:'online'}]" aria-label="Формат")
    NSelect.list-select(v-if="resource === 'rules'" v-model:value="filters.category" :options="[{label:'Все правила',value:''},{label:'Основные',value:'general'},{label:'Оффлайн',value:'offline'},{label:'Онлайн',value:'online'},{label:'Рекомендации',value:'recommendations'}]" aria-label="Категория правил")
  .active-location(v-if="filters.city")
    Icon(name="location-dot")
    span {{ filters.city }}
    button(type="button" aria-label="Снять фильтр по городу" @click="filters.city = ''")
      Icon(name="xmark")
  .filter-tags(v-if="tags.length && ['events','challenges','books'].includes(resource)")
    button.filter-tag(type="button" :class="{ selected: !selectedTags.length }" @click="filters.tag = ''") Все интересы
    button.filter-tag(v-for="tag in tags.slice(0, 12)" :key="tag.id" type="button" :class="{selected:selectedTags.includes(tag.id)}" :aria-pressed="selectedTags.includes(tag.id)" @click="toggleTag(tag.id)") {{ tag.name }}
  .list-error(v-if="error" role="alert")
    p {{ error }}
    NButton(@click="refresh") Попробовать снова
  .resource-grid(v-else-if="loading")
    NSkeleton(v-for="n in 6" :key="n" height="17rem" style="border-radius:1rem")
  .resource-grid(v-else-if="items.length")
    ResourceCard(v-for="item in items" :key="item.id" :item="item" :resource="resource" :tag-counts="tagCounts")
  .list-empty(v-else)
    EmptyState(title="Ничего не нашлось" description="Попробуйте другое слово или уберите часть фильтров." icon="magnifying-glass")
    NButton(@click="clearFilters") Сбросить фильтры
  .list-pagination(v-if="!loading && pagination.total")
    span Показано {{ (page - 1) * pagination.limit + 1 }}–{{ Math.min(page * pagination.limit, pagination.total) }} из {{ pagination.total }}
    Pagination(:page="page" :pages="pagination.pages" @change="setPage")
  EntityEditorModal(v-if="resource === 'feedback'" v-model:show="showEditor" resource="feedback" @saved="refresh")
</template>

<style scoped>
.collection-tools{display:flex;align-items:center;flex-wrap:wrap;gap:.7rem}
.member-tag-filter{margin-bottom:1.4rem;max-width:100%}
.active-location{display:inline-flex;align-items:center;gap:.5rem;padding:.45rem .65rem;background:#34271d;border:1px solid #63442b;border-radius:.5rem;color:#dfa371;font-size:.75rem;margin-bottom:1rem}.active-location>button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:.2rem;display:flex}
.feature-page{width:100%;max-width:88rem;margin:0 auto}.list-page-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.8rem}.collection-count{flex-shrink:0;font-size:.75rem;color:#8f8c88;padding:.4rem .7rem;border:1px solid #32302d;border-radius:2rem}.list-toolbar{display:flex;flex-wrap:wrap;gap:.7rem;margin-bottom:1rem}.list-search{min-width:15rem;flex:1}.list-select{width:11.5rem}.filter-tags{display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.5rem;margin-bottom:1.4rem;scrollbar-width:thin}.filter-tag{font:inherit;font-size:.72rem;white-space:nowrap;background:#1b1b1c;border:1px solid #333033;border-radius:.45rem;padding:.6rem .8rem;color:#aaa6a3;cursor:pointer;transition:all .15s}.filter-tag:hover{border-color:#96613b;color:#ffe1c9}.filter-tag.selected{background:#3b291d;color:#ff9b53;border-color:#764421}.resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.list-pagination{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:2rem 0;font-size:.72rem;color:#88817b}.list-error{padding:2rem;background:#2b1818;border:1px solid #763f38;border-radius:1rem;color:#e6aca2}.list-empty{text-align:center;padding:3rem 1rem;border:1px dashed #3e3935;border-radius:1rem}.list-empty :deep(.n-button){margin-top:1rem}@media(max-width:70rem){.resource-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:42rem){.resource-grid{grid-template-columns:1fr}.list-page-heading{align-items:flex-start;flex-direction:column;margin-bottom:1.2rem}.list-toolbar{gap:.5rem}.list-search{flex-basis:100%}.list-select{flex:1;min-width:8.5rem}.list-pagination{flex-direction:column;align-items:center}.collection-count{display:none}.filter-tags{margin-bottom:1rem}.filter-tag{padding:.7rem .8rem}}
</style>
