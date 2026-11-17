import { describe, expect, it } from 'vitest';
import { findLocationCountry, selectLocationCity, selectLocationCountry } from './locationSelection';
import type { LocationCountry } from '@shared/location-catalog';

const countries: LocationCountry[] = [
  { code: 'RU', name: 'Россия', aliases: ['Russia', 'Российская Федерация'] },
  { code: 'BY', name: 'Беларусь', aliases: ['Belarus', 'Белоруссия'] },
];
const imported = { country: 'Russia', city: 'Импортированный посёлок', lat: 54.123, lng: 36.789 };
describe('country and city selection', () => {
  it('recognizes imported country aliases and preserves untouched imported coordinates', () => {
    expect(findLocationCountry(imported.country, countries)?.code).toBe('RU');
    expect(selectLocationCountry(imported, countries[0]!, countries)).toBe(imported);
    expect(imported.city).toBe('Импортированный посёлок');
  });
  it('clears a previous city and coordinates when changing country', () => {
    expect(selectLocationCountry(imported, countries[1]!, countries)).toEqual({ country: 'Беларусь', city: '', lat: null, lng: null });
  });
  it('sets known city coordinates and clears them for a custom or cleared city', () => {
    expect(selectLocationCity(imported, { id: '1', name: 'Москва', countryCode: 'RU', region: '', lat: 55.75, lng: 37.6, population: 1 }))
      .toEqual({ country: 'Russia', city: 'Москва', lat: 55.75, lng: 37.6 });
    expect(selectLocationCity(imported, '  Новый посёлок  ')).toEqual({ country: 'Russia', city: 'Новый посёлок', lat: null, lng: null });
    expect(selectLocationCity(imported, null)).toEqual({ country: 'Russia', city: '', lat: null, lng: null });
  });
});
