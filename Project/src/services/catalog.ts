import type { CatalogKind } from '@shared/catalog';
import type { ApiResponse } from '@shared/contracts';
import { CatalogEntryBuilder, buildCatalogList } from '@/domain/catalog';
import { api } from './api';

export type CatalogSort = 'name' | '-name' | 'usage' | '-usage';
export interface CatalogFilters { q: string; sort: CatalogSort; page: number; limit: number }
const path = (kind: CatalogKind, id?: string) => `/admin/catalogs/${kind}${id ? `/${encodeURIComponent(id)}` : ''}`;

export const catalogService = {
  async list(kind: CatalogKind, filters: CatalogFilters, signal?: AbortSignal) {
    return buildCatalogList(await api.get<unknown>(path(kind), { ...filters }, signal));
  },
  async create(kind: CatalogKind, name: string) {
    const result = await api.post<ApiResponse<unknown>>(path(kind), { name });
    return new CatalogEntryBuilder().from(result.data).build();
  },
  async rename(kind: CatalogKind, id: string, name: string) {
    const result = await api.patch<ApiResponse<unknown>>(path(kind, id), { name });
    return new CatalogEntryBuilder().from(result.data).build();
  },
  async remove(kind: CatalogKind, id: string) {
    await api.delete<ApiResponse<{ success: boolean }>>(path(kind, id));
  },
};
