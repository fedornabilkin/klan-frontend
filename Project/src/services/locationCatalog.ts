import type { ApiResponse, ListResponse } from '@shared/contracts';
import type { LocationCity, LocationCountry } from '@shared/location-catalog';
import { api } from './api';

import { subscribeRealtime } from './realtime';

let countries: Promise<LocationCountry[]> | undefined;
subscribeRealtime(message => {
  if (message.type === 'invalidate' && ['*', 'location-catalog'].includes(message.resource)) countries = undefined;
});
export const locationCatalog = {
  countries() {
    countries ??= api.get<ApiResponse<LocationCountry[]>>('/location-catalog/countries').then(response => response.data)
      .catch(error => { countries = undefined; throw error; });
    return countries;
  },
  cityPage(country: string, q: string, page: number, limit: number, signal?: AbortSignal) {
    return api.get<ListResponse<LocationCity>>('/location-catalog/cities', { country, q, page, limit }, signal);
  },
  async saveCountry(code: string, name: string, original?: string) {
    const path = '/location-catalog/countries';
    const response = original ? await api.patch<ApiResponse<LocationCountry>>(path + '/' + encodeURIComponent(original), { code, name })
      : await api.post<ApiResponse<LocationCountry>>(path, { code, name });
    countries = undefined;
    return response.data;
  },
  async saveCity(country: string, values: Pick<LocationCity,'name'|'region'|'lat'|'lng'>, id?: string) {
    const path = '/location-catalog/countries/' + encodeURIComponent(country) + '/cities';
    return id ? api.patch<ApiResponse<LocationCity>>(path + '/' + encodeURIComponent(id), values) : api.post<ApiResponse<LocationCity>>(path, values);
  },
  async cities(country: string, q: string, signal?: AbortSignal) {
    const response = await api.get<ApiResponse<LocationCity[]>>('/location-catalog/cities', { country, q, limit: 40 }, signal);
    return response.data;
  },
};
