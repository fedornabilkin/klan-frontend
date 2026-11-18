import type { Location } from '@shared/contracts';
import type { LocationCity, LocationCountry } from '@shared/location-catalog';

export const normalizeCountryName = (value: string) => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
export function findLocationCountry(name: string, countries: LocationCountry[]): LocationCountry | undefined {
  const query = normalizeCountryName(name);
  return countries.find(country => [country.code, country.name, ...country.aliases].some(value => normalizeCountryName(value) === query));
}
export function selectLocationCountry(current: Location, country: LocationCountry | null, countries: LocationCountry[]): Location {
  const previous = findLocationCountry(current.country, countries);
  if (country && previous?.code === country.code) return current;
  return { country: country?.name ?? '', city: '', lat: null, lng: null };
}
export function selectLocationCity(current: Location, city: LocationCity | string | null): Location {
  if (city && typeof city === 'object') return { ...current, city: city.name, lat: city.lat, lng: city.lng };
  return { ...current, city: city?.trim() ?? '', lat: null, lng: null };
}
