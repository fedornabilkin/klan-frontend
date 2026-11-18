import type { CatalogEntry, CatalogListResponse } from '@shared/catalog';
import { InvalidDtoError, object } from './builders';

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new InvalidDtoError(field);
  return value;
}

export class CatalogEntryModel implements CatalogEntry {
  constructor(public id: string, public name: string, public usage: CatalogEntry['usage']) {}
  get canDelete(): boolean { return this.usage.total === 0; }
}

export class CatalogEntryBuilder {
  private value?: CatalogEntryModel;
  from(input: unknown): this {
    const dto = object(input, 'catalog entry');
    const usage = object(dto.usage, 'catalog usage');
    if (typeof dto.id !== 'string' || !dto.id || typeof dto.name !== 'string' || !dto.name) throw new InvalidDtoError('catalog entry.name');
    this.value = new CatalogEntryModel(dto.id, dto.name, {
      users: count(usage.users, 'usage.users'),
      entities: count(usage.entities, 'usage.entities'),
      participants: count(usage.participants, 'usage.participants'),
      total: count(usage.total, 'usage.total'),
    });
    return this;
  }
  build(): CatalogEntryModel {
    if (!this.value) throw new InvalidDtoError('catalog entry');
    return this.value;
  }
}

export interface CatalogList extends Omit<CatalogListResponse, 'data'> { data: CatalogEntryModel[] }
export function buildCatalogList(input: unknown): CatalogList {
  const dto = object(input, 'catalog list');
  const meta = object(dto.meta, 'catalog meta');
  const summary = object(dto.summary, 'catalog summary');
  if (!Array.isArray(dto.data)) throw new InvalidDtoError('catalog data');
  const result = {
    data: dto.data.map(row => new CatalogEntryBuilder().from(row).build()),
    meta: { page: count(meta.page, 'meta.page'), limit: count(meta.limit, 'meta.limit'), total: count(meta.total, 'meta.total'), pages: count(meta.pages, 'meta.pages') },
    summary: { entries: count(summary.entries, 'summary.entries'), used: count(summary.used, 'summary.used'), unused: count(summary.unused, 'summary.unused') },
  };
  if (!result.meta.page || !result.meta.limit || !result.meta.pages) throw new InvalidDtoError('catalog pagination');
  return result;
}
