import { challengeStandings } from './challengeStandings';
import { describe, expect, it } from 'vitest';
import type { ChallengeResult, Entity, User } from '@shared/contracts';
import { challengeCalendar, challengeTeamOptions, challengeResultMatcher, paginateChallengeResults, resultPeriod } from './challengeResults';

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

describe('challenge calendar', () => {
  it('allows editing only between the start and finish instants and through the current UTC day', () => {
    const challenge = {status:'active', schedule:{start:'2026-11-01T09:00:00Z',end:'2026-11-30T18:00:00Z'}};
    expect(resultPeriod(challenge,new Date('2026-11-01T08:59:59Z')).open).toBe(false);
    expect(resultPeriod(challenge,new Date('2026-11-02T00:30:00+03:00'))).toMatchObject({open:true,first:'2026-11-01',last:'2026-11-01'});
    expect(resultPeriod(challenge,new Date(challenge.schedule.end)).open).toBe(false);
    expect(resultPeriod({...challenge,status:'archived'},new Date(challenge.schedule.start)).open).toBe(false);
  });
  it('retains zeros, missing days, former participants and distinct people with the same name', () => {
    const entity = { participants: [{ user: first }, { user: namesake }, { user: user('u4') }], results: [...rows, { ...rows[1]!, value: 3 }] };
    const matrix = challengeCalendar(entity, '2026-11-20');
    expect(matrix.months.map(month => [month.key, month.count])).toEqual([['2026-10', 31]]);
    expect(matrix.rows.map(r => r.user.id)).toEqual(['u3', 'u1', 'u2', 'u4']);
    expect(matrix.rows[1]!.values.get('2026-10-01')).toBe(0);
    expect(matrix.rows[1]!.values.get('2026-10-02')).toBe(21);
    expect(matrix.rows[2]!.values.has('2026-10-01')).toBe(false);
    expect(matrix.rows[3]!.values.size).toBe(0);
    expect(matrix.total).toBe(60);
  });
  it('combines plain text and historical scoring team before counting and grouping by day', () => {
    const person = { ...first, name: 'Фёдор Петров', callsign: 'Маяк', username: 'petrov_f' };
    const participants = [{ user: person, team: south }, { user: third, team: south }];
    const results = [{ user: person, team: north, date: '2026-01-30', value: 0 },
      { user: person, team: south, date: '2026-02-01', value: 5 },
      { user: person, date: '2026-02-02', value: 12 }];
    const pending = { user: third, team: { id: 'old', title: 'Архив' }, value: 7, reason: '', sourceCell: 'A1' };
    expect(challengeTeamOptions({ participants, results, pendingResults: [pending] }).map(t => t.value)).toEqual(['old','north','south','']);
    for (const query of ['маяк','ФЕДОР','Петров Фёдор','@petrov']) {
      const selection = challengeCalendar({ participants, results }, '2026-02-10', challengeResultMatcher('north', query));
      expect(selection.count).toBe(1);
      expect(selection.total).toBe(0);
      expect(selection.rows.map(r => r.user.id)).toEqual([person.id]);
      expect([...selection.rows[0]!.values]).toEqual([['2026-01-30', 0]]);
      expect(selection.months.map(m => m.key)).toEqual(['2026-01','2026-02']);
    }
    expect(challengeCalendar({ participants, results }, '2026-02-10', challengeResultMatcher('', 'маяк')).total).toBe(12);
    expect(challengeResultMatcher('old','Соколов')(pending)).toBe(true);
    expect(challengeResultMatcher('south','Соколов')(pending)).toBe(false);
    expect(challengeCalendar({ participants, results }, '2026-02-10', challengeResultMatcher('south','нет такого')).rows).toEqual([]);
  });
  it('includes full consecutive calendar months, including empty months and leap day', () => {
    const schedule = { start: '2023-12-28T10:00:00Z', end: '2024-03-03T10:00:00Z' };
    const matrix = challengeCalendar({ participants: [], schedule }, '2026-11-20');
    expect(matrix.months.map(month => month.count)).toEqual([31,31,29,31]);
    expect(matrix.days).toContain('2024-02-29');
    expect(matrix.days.at(0)).toBe('2023-12-01');
    expect(matrix.days.at(-1)).toBe('2024-03-31');
    expect(challengeCalendar({ participants: [] }, '2026-02-12').days).toHaveLength(28);
  });
  it('paginates undated results separately and keeps their full total', () => {
    const rows = Array.from({ length: 50 }, () => ({ value: 3 }));
    expect(paginateChallengeResults(rows, 9)).toMatchObject({page:2, value:150, first:26, last:50});
  });
});

it('ranks every team including zero scores and bases goals only on distinct enrolled members', () => {
  const empty = {id:'empty',title:'Команда без участников'};
  const entity: Entity = {id:'c',type:'challenges',title:'C',description:'',category:'count',status:'active',tags:[],createdAt:'',
    challengeTeams:[empty,south,north],goal:{target:1000,unit:'раз',scope:'participant'},
    participants:[{user:first,team:north},{user:namesake,team:north},{user:third},{user:first,team:north}],results:rows,
    pendingResults:[{user:first,team:north,value:999,sourceCell:'K1',reason:'Нет даты'}]};
  const s = challengeStandings(entity);
  expect(s.target).toBe(3000);
  expect(s.score).toBe(57);
  expect(s.teams.map(r=>[r.team.id,r.score,r.target])).toEqual([['north',30,2000],['south',20,0],['empty',0,0]]);
  expect(s.people.map(r=>[r.user.id,r.score])).toEqual([['u1',38],['u2',12],['u3',7]]);
  expect(challengeStandings({...entity,participants:[],results:[]}).target).toBe(0);
});
