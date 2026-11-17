import { describe, expect, it } from 'vitest';
import type { ChallengePendingResult, ChallengeResult, User } from '@shared/contracts';
import { filterChallengeResults, filterPendingChallengeResults, paginateChallengeResults, resultDateLabel, SOLO_RESULT_TEAM } from './challengeResults';

const user = (id: string, name = 'Иван Петров'): User => ({
  id, name, publicId: Number(id.slice(1)), role: 'member', bio: '', initials: 'ИП', color: '#abc',
  location: { city: '', country: '', lat: null, lng: null }, tags: [], facts: [], interests: [], achievements: [],
  stats: { events: 0, challenges: 0, books: 0 }, joinedAt: '2026-01-01',
});
const first = user('u1'), namesake = user('u2'), third = user('u3', 'Алексей Соколов');
const north = { id: 'north', title: 'Север' }, south = { id: 'south', title: 'Юг' };
const rows: ChallengeResult[] = [
  { user: first, date: '2026-10-01', value: 0, team: north },
  { user: first, date: '2026-10-02', value: 18, team: north },
  { user: namesake, date: '2026-10-02', value: 12, team: north },
  { user: first, date: '2026-10-03', value: 20, team: south },
  { user: third, date: '2026-10-03', value: 7 },
];

describe('Challenge daily results', () => {
  it('combines inclusive date, participant identity and historical team filters without losing zero results', () => {
    const filtered = filterChallengeResults(rows, { userId: first.id, teamId: north.id, from: '2026-10-01', to: '2026-10-02' });
    expect(filtered.map(row => [row.date, row.value])).toEqual([['2026-10-02', 18], ['2026-10-01', 0]]);
    expect(filtered.every(row => row.user.id !== namesake.id)).toBe(true);
    expect(filterChallengeResults(rows, { userId: first.id, teamId: south.id })).toEqual([rows[3]]);
    expect(filterChallengeResults(rows, { teamId: SOLO_RESULT_TEAM })).toEqual([rows[4]]);
  });

  it('sorts days newest first and names consistently without changing source data', () => {
    const before = [...rows];
    const sorted = filterChallengeResults(rows, {});
    expect(sorted.map(row => `${row.date}/${row.user.id}`)).toEqual([
      '2026-10-03/u3', '2026-10-03/u1', '2026-10-02/u1', '2026-10-02/u2', '2026-10-01/u1',
    ]);
    expect(rows).toEqual(before);
  });

  it('paginates thousands of rows while retaining the full filtered sum and clamping stale pages', () => {
    const many = Array.from({ length: 1002 }, (_, index) => ({ ...rows[0]!, value: index % 2 }));
    const middle = paginateChallengeResults(many, 2);
    expect(middle.rows).toHaveLength(25);
    expect(middle).toMatchObject({ total: 1002, value: 501, page: 2, pages: 41, first: 26, last: 50 });
    expect(paginateChallengeResults(many, 999)).toMatchObject({ page: 41, first: 1001, last: 1002 });
    expect(paginateChallengeResults(many, 999).rows).toHaveLength(2);
    expect(paginateChallengeResults(rows.slice(0, 1), 41)).toMatchObject({ page: 1, total: 1, value: 0 });
  });

  it('represents empty results and reversed date ranges as no matching records', () => {
    const empty = filterChallengeResults(rows, { from: '2026-10-03', to: '2026-10-01' });
    expect(paginateChallengeResults(empty, 5)).toEqual({ rows: [], page: 1, pages: 1, total: 0, value: 0, first: 0, last: 0 });
    expect(resultDateLabel('2026-10-01')).toBe('01.10.2026');
  });

  it('keeps undated entries separate and filters by their historical participant and team only', () => {
    const pending: ChallengePendingResult[] = [
      { user: first, value: 35, team: north, sourceCell: 'AJ12', reason: 'Нет заголовка даты' },
      { user: first, value: 0, team: north, sourceCell: 'AJ2', reason: 'Нет заголовка даты' },
      { user: namesake, value: 90, team: south, sourceCell: 'AJ3', reason: 'Разметка дат отличается' },
    ];
    const selectedPending = filterPendingChallengeResults(pending, { userId: first.id, teamId: north.id });
    expect(selectedPending.map(row => [row.sourceCell, row.value])).toEqual([['AJ2', 0], ['AJ12', 35]]);
    expect(paginateChallengeResults(selectedPending, 1)).toMatchObject({ value: 35, total: 2 });
    expect(paginateChallengeResults(filterChallengeResults(rows, {}), 1)).toMatchObject({ value: 57, total: 5 });
    expect(selectedPending.every(row => !('date' in row))).toBe(true);
    expect(pending[0]?.sourceCell).toBe('AJ12');
  });
});
