<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton, NFormItem, NSelect, type SelectInst, type SelectOption } from 'naive-ui';
import type { Location } from '@shared/contracts';
import type { LocationCity, LocationCountry } from '@shared/location-catalog';
import { locationCatalog } from '@/services/locationCatalog';
import { errorMessage } from '@/services/api';
import { findLocationCountry, normalizeCountryName, selectLocationCity, selectLocationCountry } from '@/domain/locationSelection';

const props = defineProps<{ modelValue: Location; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: Location] }>();
const countries = ref<LocationCountry[]>([]);
const cities = ref<LocationCity[]>([]);
const countriesLoading = ref(false);
const citiesLoading = ref(false);
const countryError = ref('');
const cityError = ref('');
const query = ref('');
const citySelect = ref<SelectInst | null>(null);
const cityMenuOpen = ref(false);
const customCityName = computed(() => {
  const name = query.value.trim();
  if (!name || name.length > 100 || normalizeCountryName(name) === normalizeCountryName(props.modelValue.city)
    || cities.value.some(city => normalizeCountryName(city.name) === normalizeCountryName(name))) return '';
  return name;
});
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const selectedCountry = computed(() => findLocationCountry(props.modelValue.country, countries.value));
const countryValue = computed(() => selectedCountry.value?.code ?? (props.modelValue.country ? 'saved-country' : null));
const countryOptions = computed(() => {
  const options = countries.value.map(country => ({ value: country.code, label: country.name }));
  return countryValue.value === 'saved-country' ? [{ value: 'saved-country', label: props.modelValue.country }, ...options] : options;
});
const cityValue = computed(() => props.modelValue.city ? 'saved-city' : null);
const cityOptions = computed(() => {
  const nameCounts = new Map<string, number>();
  for (const city of cities.value) nameCounts.set(city.name, (nameCounts.get(city.name) ?? 0) + 1);
  const options = cities.value.map(city => ({
    value: `city:${city.id}`,
    label: (nameCounts.get(city.name) ?? 0) > 1 ? `${city.name} · ${city.region || city.id}` : city.name,
  }));
  return props.modelValue.city ? [{ value: 'saved-city', label: props.modelValue.city }, ...options] : options;
});
function filterCountry(pattern: string, option: SelectOption) {
  const country = countries.value.find(item => item.code === option.value);
  const text = country ? [country.name, country.code, ...country.aliases].join(' ') : String(option.label ?? '');
  return normalizeCountryName(text).includes(normalizeCountryName(pattern));
}
async function loadCountries() {
  countriesLoading.value = true;
  countryError.value = '';
  try { const result = await locationCatalog.countries(); if (!disposed) countries.value = result; }
  catch (error) { if (!disposed) countryError.value = errorMessage(error); }
  finally { if (!disposed) countriesLoading.value = false; }
}
async function loadCities() {
  controller?.abort();
  controller = new AbortController();
  const request = controller;
  const code = selectedCountry.value?.code;
  cities.value = [];
  cityError.value = '';
  if (!code) { citiesLoading.value = false; return; }
  citiesLoading.value = true;
  try {
    const result = await locationCatalog.cities(code, query.value, request.signal);
    if (!disposed && !request.signal.aborted) cities.value = result;
  } catch (error) { if (!disposed && !request.signal.aborted) cityError.value = errorMessage(error); }
  finally { if (!disposed && !request.signal.aborted) citiesLoading.value = false; }
}
function changeCountry(value: string | number | null) {
  if (props.disabled || value === 'saved-country') return;
  const country = countries.value.find(item => item.code === value) ?? null;
  const next = selectLocationCountry(props.modelValue, country, countries.value);
  if (next === props.modelValue) return;
  query.value = '';
  cities.value = [];
  controller?.abort();
  emit('update:modelValue', next);
}
function changeCity(value: string | number | null) {
  if (props.disabled || value === 'saved-city') return;
  const known = cities.value.find(city => `city:${city.id}` === value);
  if (known && known.countryCode !== selectedCountry.value?.code) return;
  const custom = value === null ? null : String(value).trim();
  if (!known && custom && custom.length > 100) { cityError.value = 'Название города должно содержать не более 100 символов.'; return; }
  emit('update:modelValue', selectLocationCity(props.modelValue, known ?? custom));
  query.value = '';
}
function useCustomCity() {
  if (props.disabled || !props.modelValue.country.trim() || !customCityName.value) return;
  emit('update:modelValue', selectLocationCity(props.modelValue, customCityName.value));
  query.value = '';
  cityMenuOpen.value = false;
  citySelect.value?.blur();
}
watch(() => selectedCountry.value?.code, () => { query.value = ''; void loadCities(); });
watch(query, () => { clearTimeout(timer); controller?.abort(); timer = setTimeout(() => { void loadCities(); }, 220); });
onMounted(() => { void loadCountries(); });
onBeforeUnmount(() => { disposed = true; controller?.abort(); clearTimeout(timer); });
</script>

<template lang="pug">
.country-city-editor
  .location-fields
    NFormItem(label="Страна")
      NSelect(:value="countryValue" :options="countryOptions" :filter="filterCountry" filterable clearable :loading="countriesLoading" :disabled="disabled" placeholder="Найдите страну" aria-label="Страна" @update:value="changeCountry")
    NFormItem(label="Город")
      .city-control
        NSelect(ref="citySelect" :show="cityMenuOpen" :value="cityValue" :options="cityOptions" filterable remote clearable :loading="citiesLoading" :disabled="disabled || !modelValue.country.trim()" :input-props="{maxlength:100}" placeholder="Найдите или введите город" aria-label="Город" @search="query = $event" @update:value="changeCity" @update:show="cityMenuOpen = $event")
          template(#action v-if="customCityName")
            NButton.use-custom-city(secondary block attr-type="button" :disabled="disabled" @mousedown.prevent @keydown.enter.stop @keydown.space.stop @click="useCustomCity") Использовать «{{ customCityName }}»
        NButton.use-custom-city(v-if="customCityName && !cityMenuOpen" secondary block attr-type="button" :disabled="disabled || !modelValue.country.trim()" @click="useCustomCity") Использовать «{{ customCityName }}»
  p.location-help Выберите город из списка, чтобы отметить его на карте. Если вашего города нет, введите название и нажмите «Использовать» — координаты можно будет уточнить позже.
  .location-error(v-if="countryError" role="alert")
    span {{ countryError }}
    NButton(text size="small" :disabled="disabled" @click="loadCountries") Повторить
  .location-error(v-if="cityError" role="alert")
    span {{ cityError }}
    NButton(text size="small" :disabled="disabled" @click="loadCities") Повторить
  p.location-source
    | Справочник городов: 
    a(href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer") GeoNames
    |  · 
    a(href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer") CC BY 4.0
</template>

<style scoped>
.city-control{width:100%;display:grid;gap:.5rem}.use-custom-city{min-height:2.75rem;height:auto;white-space:normal}.use-custom-city :deep(.n-button__content){white-space:normal;overflow-wrap:anywhere;padding:.35rem 0}
.country-city-editor{width:100%}.location-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.location-fields :deep(.n-form-item){margin:0}.location-help{font-size:.75rem;color:var(--muted,#aaa);line-height:1.6;margin:0 0 .55rem}.location-source{font-size:.65rem;color:var(--muted,#8f8a84);margin:0}.location-source a{color:inherit;text-decoration:underline;text-underline-offset:.15rem}.location-error{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;color:#efa194;font-size:.75rem;margin:.5rem 0}@media(max-width:36rem){.location-fields{grid-template-columns:1fr;gap:0}}
</style>
