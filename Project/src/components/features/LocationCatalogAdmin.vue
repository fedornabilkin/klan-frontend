<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NAlert, NButton, NFormItem, NInput, NModal } from 'naive-ui';
import type { LocationCity, LocationCountry } from '@shared/location-catalog';
import { locationCatalog } from '@/services/locationCatalog';
import { errorMessage } from '@/services/api';
import { useRealtime } from '@/composables/useRealtime';
import { useQueryFilters } from '@/composables/useQueryFilters';
import { searchTerm } from '@/composables/useFilterDelay';
import { normalizeCountryName } from '@/domain/locationSelection';
import Pagination from '@/components/ui/Pagination.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import NumberField from '@/components/ui/NumberField.vue';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{ tab: 'countries'|'cities' }>();
const route = useRoute(), router = useRouter();
const countries = ref<LocationCountry[]>([]), cities = ref<LocationCity[]>([]);
const limit = 20, totalCities = ref(0), refresh = ref(0);
const q = computed(() => typeof route.query.q === 'string' ? searchTerm(route.query.q.slice(0,100)) : '');
const search = ref(q.value);
const applyFilters = useQueryFilters();
const page = computed(() => {
  const n = Number(route.query.page);
  return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1;
});
function changePage(n: number) { void router.push({query:{...route.query,page:n > 1 ? String(n) : undefined}}); }
watch(q, value => { if (searchTerm(search.value) !== value) search.value = value; });
watch(search, value => applyFilters({q:searchTerm(value) || undefined,page:undefined}));
const country = computed(() => typeof route.query.country === 'string' ? route.query.country : 'RU');
const options = computed(() => countries.value.map(c => ({ value:c.code,label:c.name })));
const filtered = computed(() => countries.value.filter(c => [c.name,c.code,...c.aliases].some(s => normalizeCountryName(s).includes(normalizeCountryName(q.value)))));
const pageCountries = computed(() => filtered.value.slice((page.value-1)*limit, page.value*limit));
const total = computed(() => props.tab === 'countries' ? filtered.value.length : totalCities.value);
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)));
const loading = ref(false), error = ref('');
function showCities(code: string) { void router.push({ query:{ catalog:'cities', country:code } }); }
watch([() => props.tab, country], () => { search.value = q.value; editor.value = false; });
watch([() => props.tab, country, q, page, refresh], async (_, __, cleanup) => {
  const controller = new AbortController(); cleanup(() => controller.abort());
  loading.value = true; error.value = '';
  try {
    const list = await locationCatalog.countries();
    if (controller.signal.aborted) return;
    countries.value = list;
    if (props.tab === 'cities') {
      const result = await locationCatalog.cityPage(country.value, q.value, page.value, limit, controller.signal);
      if (controller.signal.aborted) return;
      cities.value = result.data; totalCities.value = result.meta.total;
    }
    if (page.value > pages.value) void router.replace({query:{...route.query,page:pages.value > 1 ? String(pages.value) : undefined}});
  } catch (cause) { if (!controller.signal.aborted) error.value = errorMessage(cause); }
  finally { if (!controller.signal.aborted) loading.value = false; }
}, { immediate:true });
useRealtime(message => { if (message.type === 'invalidate' && ['location-catalog','*'].includes(message.resource)) refresh.value++; });
const editor = ref(false), saving = ref(false), saveError = ref(''), original = ref<string>();
const draft = ref({ code:'', name:'', region:'', lat:null as number|null, lng:null as number|null });
function edit(item?: LocationCity|LocationCountry) {
  original.value = item && ('code' in item ? item.code : item.id);
  draft.value = { code:item && 'code' in item ? item.code : '', name:item?.name ?? '', region:item && 'region' in item ? item.region : '',
    lat:item && 'lat' in item ? item.lat : null, lng:item && 'lng' in item ? item.lng : null };
  saveError.value = ''; editor.value = true;
}
async function save() {
  if (saving.value) return;
  const { code, name, region, lat, lng } = draft.value;
  saveError.value = '';
  if (!name.trim()) { saveError.value = 'Введите название.'; return; }
  if (props.tab === 'cities' && ((lat == null) !== (lng == null))) { saveError.value = 'Укажите обе координаты или оставьте обе пустыми.'; return; }
  saving.value = true;
  try {
    if (props.tab === 'countries') await locationCatalog.saveCountry(code.trim().toUpperCase(), name.trim(), original.value);
    else await locationCatalog.saveCity(country.value, { name:name.trim(), region:region.trim(), lat, lng }, original.value);
    editor.value = false; refresh.value++;
  } catch (cause) { saveError.value = errorMessage(cause); }
  finally { saving.value = false; }
}
</script>
<template lang="pug">
section.geo-catalog
  .geo-tools
    SearchSelect(v-if="tab === 'cities'" :value="country" :options="options" aria-label="Страна" placeholder="Страна" @update:value="showCities")
    NInput(v-model:value="search" clearable :maxlength="100" placeholder="Поиск по названию (от 3 символов)" aria-label="Поиск по названию")
    NButton(type="primary" @click="edit()") {{ tab === 'countries' ? 'Добавить страну' : 'Добавить город' }}
  NAlert(v-if="error" type="error") {{ error }}
    NButton(size="small" @click="refresh++") Повторить
  p(v-else-if="loading" role="status") Загрузка…
  template(v-else)
    small Найдено: {{ total }}
    ul(v-if="total")
      template(v-if="tab === 'countries'")
        li(v-for="item in pageCountries" :key="item.code")
          button.country-link(type="button" @click="showCities(item.code)") {{ item.name }}
          small {{ item.code }}
          NButton(circle secondary :aria-label="'Редактировать ' + item.name" @click="edit(item)")
            Icon(name="pen")
      template(v-else)
        li(v-for="city in cities" :key="city.id")
          div
            strong {{ city.name }}
            small {{ [city.region, city.lat != null && city.lng != null ? city.lat + ', ' + city.lng : 'Координаты не заданы'].filter(Boolean).join(' · ') }}
          NButton(circle secondary :aria-label="'Редактировать ' + city.name" @click="edit(city)")
            Icon(name="pen")
    p(v-else) Записи не найдены.
    Pagination(:page="page" :pages="pages" @change="changePage")
  NModal(v-model:show="editor" preset="card" :title="tab === 'countries' ? (original ? 'Редактировать страну' : 'Добавить страну') : (original ? 'Редактировать город' : 'Добавить город')" style="width:min(28rem, calc(100vw - 2rem))" :mask-closable="!saving" :closable="!saving" :close-on-esc="!saving")
    form(@submit.prevent="save")
      NFormItem(label="Название" required)
        NInput(v-model:value="draft.name" aria-label="Название" :maxlength="100" :disabled="saving")
      NFormItem(v-if="tab === 'countries'" label="Код страны (две латинские буквы)" required)
        NInput(v-model:value="draft.code" aria-label="Код страны" :maxlength="2" :disabled="!!original || saving")
      template(v-else)
        NFormItem(label="Регион")
          NInput(v-model:value="draft.region" aria-label="Регион" :maxlength="100" :disabled="saving")
        .coordinates
          NFormItem(label="Широта")
            NumberField(v-model="draft.lat" step="any" min="-90" max="90" aria-label="Широта" :disabled="saving")
          NFormItem(label="Долгота")
            NumberField(v-model="draft.lng" step="any" min="-180" max="180" aria-label="Долгота" :disabled="saving")
      NAlert(v-if="saveError" type="error" role="alert") {{ saveError }}
      NButton(type="primary" attr-type="submit" :loading="saving") Сохранить
</template>
<style scoped>
.geo-catalog{display:grid;gap:1rem}.geo-tools,.coordinates{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap}.geo-tools>:not(button),.coordinates>*{flex:1 1 10rem;min-width:0}.geo-catalog ul{margin:0;padding:0;list-style:none}.geo-catalog li{display:flex;align-items:center;gap:.7rem;padding:.75rem;border-bottom:1px solid var(--border)}.geo-catalog li>button:last-child{margin-left:auto;flex-shrink:0}.geo-catalog small{color:var(--muted);display:block}.country-link{padding:0;border:0;color:var(--text);background:transparent;font:inherit;cursor:pointer}.country-link:hover{color:var(--accent)}
</style>
