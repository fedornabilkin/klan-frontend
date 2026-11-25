<script setup lang="ts">
import UserAvatar from "@/components/ui/UserAvatar.vue"
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton, NInput, NSelect, NSkeleton } from 'naive-ui'
import type { Entity, Resource, User } from '@shared/contracts'
import { communityService } from '@/services/community'
import { useList } from '@/composables/useList'
import { memberFilters, selectedMemberFilters, type MemberFilterKey } from '@/domain/adminMemberFilters'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import EntityEditorModal from '@/components/features/EntityEditorModal.vue'
import ConfirmDeleteModal from '@/components/features/ConfirmDeleteModal.vue'

const route = useRoute()
const router = useRouter()
import { useFilterDelay } from '@/composables/useFilterDelay'
const resourceDelay = useFilterDelay()
const auth = useAuthStore()
const resourceOptions: { label: string; value: Resource }[] = [
  { label: 'Участники', value: 'users' }, { label: 'Мероприятия', value: 'events' }, { label: 'Команды', value: 'teams' },
  { label: 'Челленджи', value: 'challenges' }, { label: 'Новости', value: 'news' }, { label: 'Обратная связь', value: 'feedback' },
  { label: 'Книги', value: 'books' }, { label: 'Правила', value: 'rules' },
]
const resources = computed(() => resourceOptions.filter(item => item.value !== 'users' || auth.can('members.manage')))
const resource = computed<Resource>(() => resources.value.some(r => r.value === route.query.resource) ? route.query.resource as Resource : resources.value[0]?.value ?? 'events')
const { items, meta, loading, error, filters, page, refresh, setPage } = useList(resource, { limit: 12, adminMembers: true })
const selectedFilters = computed(() => selectedMemberFilters(filters.missing))
function toggleMemberFilter(key: MemberFilterKey) {
  const next = new Set(selectedFilters.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  filters.missing = selectedMemberFilters([...next].join(',')).join(',')
}
const rows = computed(() => items.value as (User | Entity)[])
const selected = ref<Entity | User | null>(null)
const editorOpen = ref(false)
const deleteOpen = ref(false)
const titleOf = (entity: Entity | User) => 'name' in entity ? entity.name : entity.title
const descriptionOf = (entity: Entity | User) => 'bio' in entity ? entity.location.city : entity.description
function changeResource(value: unknown) { if (typeof value === 'string' && resources.value.some(item => item.value === value)) resourceDelay.schedule(() => { void router.replace({ query: { resource: value } }) }) }
let editRequest = 0
async function edit(entity: Entity | User | null) {
  if (resource.value === 'users' && !entity) return
  const request = ++editRequest
  try {
    const full = entity ? await communityService.get(resource.value, entity.id) : null
    if (request === editRequest) { selected.value = full; editorOpen.value = true }
  } catch (cause) { if (request === editRequest) error.value = cause instanceof Error ? cause.message : 'Не удалось открыть запись' }
}
function remove(entity: Entity | User) { selected.value = entity; deleteOpen.value = true }
watch(resource, () => { ++editRequest; selected.value = null; editorOpen.value = false; deleteOpen.value = false })
</script>

<template lang="pug">
.admin-page
  PageHeader(title="Управление сообществом" eyebrow="ПУЛЬТ УПРАВЛЕНИЯ" description="Участники, материалы и активность. Изменения сразу доступны сообществу.")
  NAlert(v-if="!auth.can('content.manage')" type="error" title="Доступ ограничен") Этот раздел доступен редакторам сообщества.
  template(v-else)
    .admin-links
      RouterLink(v-if="auth.isAdmin" to="/admin/access") Постоянный доступ
      RouterLink(v-if="auth.can('catalog.manage')" to="/admin/catalogs") Справочники тегов и предметов
      RouterLink(v-if="auth.can('analytics.read')" to="/admin/analytics") Аналитика сообщества и участников
    .admin-toolbar
      NSelect.admin-resource(:value="resource" :options="resources" aria-label="Тип записей" @update:value="changeResource")
      NInput.admin-search(v-model:value="filters.q" placeholder="Найти запись (от 3 символов)" clearable aria-label="Поиск записей")
        template(#prefix)
          Icon(name="search")
      NSelect.admin-sort(v-model:value="filters.sort" :options="[{ label: 'Сначала новые', value: '-createdAt' }, { label: 'По названию', value: 'name' }, { label: 'По названию: Я–А', value: '-name' }]" aria-label="Сортировка")
      NButton(v-if="resource !== 'users'" type="primary" @click="edit(null)")
        template(#icon)
          Icon(name="plus")
        | Создать
    fieldset.member-filters(v-if="resource === 'users'")
      legend Фильтры участников
      .filter-buttons
        button.member-filter(v-for="filter in memberFilters" :key="filter.key" type="button" :aria-pressed="selectedFilters.includes(filter.key)" @click="toggleMemberFilter(filter.key)") {{ filter.label }}
      .filter-summary(v-if="selectedFilters.length")
        span(v-if="selectedFilters.length > 1") Применяются все выбранные условия
        button.filter-reset(type="button" @click="filters.missing = ''") Сбросить фильтры
    NAlert(v-if="error" type="error" :title="error")
      NButton(size="small" @click="refresh") Повторить
    .admin-table-wrap(v-else)
      .admin-table-head
        span {{ resources.find(r => r.value === resource)?.label }}
        span(v-if="!loading" role="status") Найдено: {{ meta.total }}
      template(v-if="loading")
        NSkeleton(v-for="i in 5" :key="i" height="4.5rem" style="margin: 1rem; width: calc(100% - 2rem)")
      template(v-else-if="rows.length")
        .admin-row(v-for="entity in rows" :key="entity.id")
          .admin-row-main
            UserAvatar(v-if="'name' in entity" :user="entity")
            RouterLink.admin-title(v-else :to="`/${resource}/${entity.publicId ?? entity.id}`") {{ titleOf(entity) }}
            p {{ descriptionOf(entity) || ('name' in entity ? 'Город не указан' : 'Описание не добавлено') }}
          StatusBadge(v-if="'status' in entity" :status="entity.status")
          span.admin-role(v-else) {{ entity.access?.level === 'moderator' ? 'Модератор' : entity.role === 'admin' ? 'Администратор' : 'Участник' }}
          .admin-row-actions
            NButton(secondary circle :aria-label="`Редактировать ${titleOf(entity)}`" @click="edit(entity)")
              template(#icon)
                Icon(name="edit")
            NButton(secondary circle type="error" :aria-label="`Удалить ${titleOf(entity)}`" :disabled="resource === 'users' && entity.id === auth.user?.id" @click="remove(entity)")
              template(#icon)
                Icon(name="trash")
      EmptyState(v-else :title="resource === 'users' ? 'Участники не найдены' : 'Записей пока нет'" :description="resource === 'users' ? 'Измените запрос или снимите часть фильтров.' : 'Создайте первую запись или измените условия поиска.'" icon="layers")
    Pagination(v-if="!error && meta.pages > 1" :page="page" :pages="meta.pages" @change="setPage")
    EntityEditorModal(v-model:show="editorOpen" :resource="resource" :entity="selected" @saved="refresh")
    ConfirmDeleteModal(v-if="selected" v-model:show="deleteOpen" :resource="resource" :id="selected.id" :user="'name' in selected ? selected : undefined" :title="titleOf(selected)" @deleted="refresh")
</template>

<style scoped>
.admin-links { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; margin-bottom: 1.25rem; }
.admin-links a { color: var(--accent, #ff7a00); font-size: .85rem; }
.admin-page { display: grid; gap: 1.5rem; }
.admin-toolbar { display: flex; flex-wrap: wrap; gap: .75rem; }
.admin-resource { width: 13rem; }
.admin-search { flex: 1; min-width: 12rem; }
.admin-sort { width: 12rem; }
.member-filters { margin: 0; padding: .75rem 1rem 1rem; min-width: 0; border: 1px solid var(--border); border-radius: .75rem; }
.member-filters legend { padding: 0 .3rem; font-size: .87rem; font-weight: 700; }
.filter-buttons, .filter-summary { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
.member-filter, .filter-reset { font: inherit; font-size: .8rem; cursor: pointer; }
.member-filter { padding: .5rem .85rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface); color: inherit; }
.member-filter:hover, .member-filter[aria-pressed="true"] { border-color: var(--accent); }
.member-filter[aria-pressed="true"] { background: var(--accent); color: #171815; }
.filter-summary { margin-top: .75rem; color: var(--muted); font-size: .78rem; }
.filter-reset { margin-left: auto; padding: .3rem; border: 0; background: none; color: var(--accent); }
.admin-table-wrap { border: 1px solid var(--border, #2c2d2f); border-radius: .75rem; overflow: hidden; background: var(--surface, #191a1c); }
.admin-table-head { display: flex; justify-content: space-between; padding: 1rem 1.25rem; background: #ffffff03; color: #a6a6aa; font-size: .8rem; }
.admin-row { display: flex; gap: 1.25rem; align-items: center; padding: 1.25rem; border-top: 1px solid #ffffff0b; }
.admin-row-main { min-width: 0; flex: 1; }
.admin-title { font-weight: 600; color: #ededed; text-decoration: none; }
.admin-title:hover { color: #ff7a00; }
.admin-row-main p { color: #929296; font-size: .8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: .4rem 0 0; }
.admin-role { color: #a6a6aa; font-size: .75rem; }
.admin-row-actions { display: flex; gap: .5rem; }
@media(max-width: 42rem) { .admin-resource, .admin-sort { width: calc(50% - .4rem); } .admin-search { order: -1; flex-basis: 100%; } .admin-row { gap: .75rem; padding: 1rem; flex-wrap: wrap; } .admin-row-main { flex-basis: calc(100% - 6rem); } .admin-role { display: none; } }
</style>
