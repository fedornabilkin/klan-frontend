import { describe, expect, it } from 'vitest';
import { normalizeTagQuery, rankCommunityTags, rankMemberTags } from './tagPopularity';

describe('community tag popularity', () => {
  it('ranks the complete catalog by members and retains uncommon tags for search', () => {
    const catalog = [{ id: 'a', name: '3D' }, { id: 'b', name: 'Авиация' }, { id: 'c', name: 'Бег' }, { id: 'd', name: 'Музыка' }];
    const ranked = rankCommunityTags(catalog, [{ name: 'Бег', count: 50 }, { name: 'Авиация', count: 12 }, { name: '3D', count: 2 }]);
    expect(ranked.map(tag => [tag.id, tag.count])).toEqual([['c', 50], ['b', 12], ['a', 2], ['d', 0]]);
    expect(catalog[0]?.id).toBe('a');
  });
  it('shows only a member’s own tags in global popularity order without changing the profile', () => {
    const tags = [{ id: 'rare', name: '3D' }, { id: 'common', name: 'Спорт' }, { id: 'rare', name: '3D' }];
    expect(rankMemberTags(tags, new Map([['common', 40], ['rare', 2], ['not-theirs', 100]])).map(tag => tag.id)).toEqual(['common', 'rare']);
    expect(tags).toHaveLength(3);
  });
  it('normalizes Cyrillic case, ё and full-width input for search and frequency matching', () => {
    expect(normalizeTagQuery('  ПОЛЁТЫ  ')).toBe('полеты');
    expect(normalizeTagQuery('３Ｄ')).toBe('3d');
    expect(rankCommunityTags([{ id: 'x', name: 'Полёты' }], [{ name: 'ПОЛЕТЫ', count: 4 }])[0]?.count).toBe(4);
  });
});
