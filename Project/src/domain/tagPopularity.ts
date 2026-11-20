import type { Tag } from '@shared/contracts';

export interface RankedTag extends Tag { count: number }
export interface TagCount { name: string; count: number }

export function normalizeTagQuery(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
}

/** Rank the full catalog by community membership, independently of current filters. */
export function rankCommunityTags(tags: readonly Tag[], usage: readonly TagCount[]): RankedTag[] {
  const counts = new Map<string, number>();
  for (const row of usage) {
    if (!Number.isFinite(row.count) || row.count < 0) continue;
    const key = normalizeTagQuery(row.name);
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }
  const seen = new Set<string>();
  return tags.filter(tag => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  }).map(tag => ({ ...tag, count: counts.get(normalizeTagQuery(tag.name)) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
}

export function rankMemberTags(tags: readonly Tag[], counts: ReadonlyMap<string, number>): Tag[] {
  return [...new Map(tags.map(tag => [tag.id, tag])).values()]
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'ru'));
}

export function canonicalTagNames(values: readonly string[], catalog: readonly Tag[]): string[] {
  const exactNames = new Set(catalog.map(tag => tag.name));
  const byName = new Map(catalog.map(tag => [normalizeTagQuery(tag.name), tag.name]));
  const byId = new Map(catalog.map(tag => [tag.id, tag.name]));
  return [...new Set(values.map(value => exactNames.has(value) ? value : byId.get(value) ?? byName.get(normalizeTagQuery(value))
    ?? byId.get(value.replace(/^#/, '')) ?? value))];
}
