import type { ListResponse } from './contracts.js';

export type CatalogKind = 'tags' | 'items';
export interface CatalogUsage {
  users: number;
  entities: number;
  participants: number;
  total: number;
}
export interface CatalogEntry {
  id: string;
  name: string;
  usage: CatalogUsage;
}
export interface CatalogListResponse extends ListResponse<CatalogEntry> {
  summary: { entries: number; used: number; unused: number };
}
