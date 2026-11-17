import type { ApiResponse } from '@shared/contracts';
import type { LocationCity, LocationCountry } from '@shared/location-catalog';
import { api } from './api';

let countries: Promise<LocationCountry[]> | undefined;
export const locationCatalog = {
  countries() {
    countries ??= api.get<ApiResponse<LocationCountry[]>>('/location-catalog/countries').then(response => response.data)
      .catch(error => { countries = undefined; throw error; });
    return countries;
  },
  async cities(country: string, q: string, signal?: AbortSignal) {
    const response = await api.get<ApiResponse<LocationCity[]>>('/location-catalog/cities', { country, q, limit: 40 }, signal);
    return response.data;
  },
};
