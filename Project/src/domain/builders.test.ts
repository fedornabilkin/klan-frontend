import { describe, expect, it } from 'vitest';
import { buildActivity, EntityBuilder, InvalidDtoError, UserBuilder, UserModel } from './builders';
import { paginationItems } from '@/components/ui/pagination';
import { parseFilters, parsePage } from '@/composables/useList';

const user = {
  id: 'u1', name: 'Иван Петров', role: 'member', bio: 'Походы', location: { city: 'Москва', country: 'Россия', lat: 55.75, lng: 37.6 },
  tags: [{ id: 't1', name: 'Походы' }], stats: { events: 3, challenges: 1, books: 2 }, joinedAt: '2026-01-01',
};
describe('DTO → Builder → Domain', () => {
  it('builds a user with safe defaults and domain getters', () => {
    const entity = new UserBuilder().from(user).build();
    expect(entity).toBeInstanceOf(UserModel);
    expect(entity.initials).toBe('ИП');
    expect(entity.place).toBe('Москва, Россия');
    expect(entity.isAdmin).toBe(false);
  });
  it('shares people and team references across results, including dictionary index zero', () => {
    const dto = {id:'legacy',publicId:8,type:'challenges',title:'October',people:[user],teams:[{id:'old-team',publicId:2,title:'Team'}],
      participants:[{user:0,team:0}],results:[{user:0,team:0,date:'2026-10-01',value:7}]};
    const entity = new EntityBuilder().from(dto).build();
    expect(entity.results![0]!.user).toBe(entity.participants[0]!.user);
    expect(entity.results![0]!.team).toBe(entity.participants[0]!.team);
    expect(entity.results![0]!.team?.publicId).toBe(2);
    expect(() => new EntityBuilder().from({...dto,people:[]}).build()).toThrow(InvalidDtoError);
  });
  it('preserves an optional callsign from the profile DTO', () => {
    expect(new UserBuilder().from({ ...user, callsign: 'Сокол' }).build().callsign).toBe('Сокол');
    expect(new UserBuilder().from(user).build().callsign).toBeUndefined();
    expect(() => new UserBuilder().from({ ...user, callsign: 123 }).build()).toThrow(InvalidDtoError);
  });
  it('preserves structured names and real calendar birth dates without deriving missing values', () => {
    const names = { firstName: 'Иван', middleName: 'Иванович', lastName: 'Петров' };
    const parsed = new UserBuilder().from({ ...user, ...names, birthDate: '2000-02-29' }).build();
    expect(parsed).toMatchObject({ ...names, birthDate: '2000-02-29' });
    const legacy = new UserBuilder().from(user).build();
    expect(legacy.firstName).toBeUndefined();
    expect(legacy.birthDate).toBeNull();
    for (const date of ['2001-02-29', '2000-02-30', '2000-02-29T00:00:00Z', '9999-01-01', '']) {
      expect(() => new UserBuilder().from({ ...user, birthDate: date }).build()).toThrow(InvalidDtoError);
    }
    expect(() => new UserBuilder().from({ ...user, firstName: 123 }).build()).toThrow(InvalidDtoError);
  });
  it('retains all active team summaries and validates participant counts', () => {
    const activeTeams = [
      { id: 'team-1', title: 'Север', description: 'Вместе ходим в походы', memberCount: 12 },
      { id: 'team-2', title: 'Вектор', description: '', memberCount: 3 },
    ];
    expect(new UserBuilder().from({ ...user, activeTeams }).build().activeTeams).toEqual(activeTeams);
    expect(new UserBuilder().from(user).build().activeTeams).toEqual([]);
    for (const memberCount of [-1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new UserBuilder().from({ ...user, activeTeams: [{ ...activeTeams[0], memberCount }] }).build()).toThrow(InvalidDtoError);
    }
    expect(() => new UserBuilder().from({ ...user, activeTeams: {} }).build()).toThrow(InvalidDtoError);
  });
  it('preserves entry dates and text while assigning stable ids to legacy facts', () => {
    const dto = { ...user, facts: ['  Первая строка\nВторая строка  ', 'повтор', 'повтор'], achievements: [{ id: 'award-1', text: 'Диплом', date: '2024-02-29' }] };
    const parsed = new UserBuilder().from(dto).build();
    expect(parsed.facts[0]?.text).toBe(dto.facts[0]);
    expect(parsed.facts.every(entry => entry.date === null)).toBe(true);
    expect(new Set(parsed.facts.map(entry => entry.id)).size).toBe(3);
    expect(new UserBuilder().from(dto).build().facts).toEqual(parsed.facts);
    expect(parsed.achievements).toEqual(dto.achievements);
    for (const date of ['2025-02-29', '2024-02-30', '2024-02-29T00:00:00Z']) {
      expect(() => new UserBuilder().from({ ...user, facts: [{ id: 'fact-1', text: 'Факт', date }] }).build()).toThrow(InvalidDtoError);
    }
  });
  it('retains positive numeric public ids for users and activity actors', () => {
    expect(new UserBuilder().from({ ...user, publicId: 152 }).build().publicId).toBe(152);
    for (const value of [0, -1, 1.2, '152', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new UserBuilder().from({ ...user, publicId: value }).build()).toThrow(InvalidDtoError);
    }
    expect(buildActivity({ id: 'a1', action: 'обновил профиль', createdAt: '2026-01-01', actor: { ...user, publicId: 152, initials: 'ИП', color: '#fff' } }).actor.publicId).toBe(152);
  });
  it('rejects unexpected roles and invalid coordinates at the boundary', () => {
    expect(() => new UserBuilder().from({ ...user, role: 'superuser' }).build()).toThrow(InvalidDtoError);
    expect(() => new UserBuilder().from({ ...user, location: { ...user.location, lat: 95 } }).build()).toThrow(InvalidDtoError);
    expect(() => new UserBuilder().from(null).build()).toThrow(InvalidDtoError);
  });
  it('preserves unknown coordinates without manufacturing a point at zero', () => {
    const unknown = { city: '  ', country: '', lat: null, lng: null };
    const entity = new UserBuilder().from({ ...user, location: unknown }).build();
    expect(entity.location).toEqual({ city: '', country: '', lat: null, lng: null });
    expect(entity.place).toBe('');
    expect(new UserBuilder().from({ ...user, location: { city: 'Москва', country: 'Россия' } }).build().location.lat).toBeNull();
    for (const coordinates of [{ lat: null, lng: 37 }, { lat: 55, lng: null }, { lat: 91, lng: 37 }, { lat: 55, lng: 181 }]) {
      expect(() => new UserBuilder().from({ ...user, location: { ...user.location, ...coordinates } }).build()).toThrow(InvalidDtoError);
    }
    expect(new UserBuilder().from({ ...user, location: { ...user.location, lat: 0, lng: 0 } }).build().location.lat).toBe(0);
  });
  it('preserves validated server capabilities without converting moderators to administrators', () => {
    const access = { level: 'moderator', capabilities: ['community.read', 'catalog.manage', 'content.manage'], source: 'telegram' };
    const entity = new UserBuilder().from({ ...user, access }).build();
    expect(entity.access).toEqual(access);
    expect(entity.isAdmin).toBe(false);
    expect(() => new UserBuilder().from({ ...user, access: { ...access, capabilities: ['unknown.permission'] } }).build()).toThrow(InvalidDtoError);
    expect(() => new UserBuilder().from({ ...user, access: { ...access, level: 'owner' } }).build()).toThrow(InvalidDtoError);
  });
  it('builds nested participants and rejects unknown resource kinds', () => {
    const entity = new EntityBuilder().from({ id: 'e1', type: 'events', title: 'Поход', participants: [{ user }] }).build();
    expect(entity.participants[0]?.user).toBeInstanceOf(UserModel);
    expect(entity.hasParticipant('u1')).toBe(true);
    expect(() => new EntityBuilder().from({ id: 'e1', type: 'unknown', title: 'Bad' }).build()).toThrow(InvalidDtoError);
  });
  it('preserves individual targets and undated source values without adding them to dated results', () => {
    const source = {
      id: 'c1', type: 'challenges', title: 'Октябрь',
      participants: [{ user, target: 700 }, { user: { ...user, id: 'u2' }, target: 0 }],
      results: [{ user, date: '2026-10-01', value: 12 }],
      pendingResults: [{ user, value: 30, team: { id: 't1', title: 'Север' }, sourceCell: 'AJ5', reason: 'В столбце нет даты' }],
    };
    const entity = new EntityBuilder().from(source).build();
    expect(entity.participants.map(participant => participant.target)).toEqual([700, 0]);
    expect(entity.results).toHaveLength(1);
    expect(entity.results?.reduce((sum, result) => sum + result.value, 0)).toBe(12);
    expect(entity.pendingResults).toHaveLength(1);
    expect(entity.pendingResults?.[0]).toMatchObject({ value: 30, sourceCell: 'AJ5', reason: 'В столбце нет даты', team: { id: 't1' } });
    expect(entity.pendingResults?.[0]?.user).toBeInstanceOf(UserModel);
    expect(entity.pendingResults?.[0]).not.toHaveProperty('date');
    expect(new EntityBuilder().from({ id: 'c2', type: 'challenges', title: 'Без импорта' }).build().pendingResults).toEqual([]);
  });
  it('rejects invalid undated amounts, missing provenance and malformed individual targets', () => {
    const base = { id: 'c1', type: 'challenges', title: 'Октябрь' };
    const pending = { user, value: 0, sourceCell: 'AJ5', reason: 'Дата не указана' };
    for (const patch of [{ value: -1 }, { value: Infinity }, { value: '30' }, { sourceCell: '' }, { reason: ' ' }, { sourceCell: null }]) {
      expect(() => new EntityBuilder().from({ ...base, pendingResults: [{ ...pending, ...patch }] }).build()).toThrow(InvalidDtoError);
    }
    for (const target of [-1, Infinity, '100']) {
      expect(() => new EntityBuilder().from({ ...base, participants: [{ user, target }] }).build()).toThrow(InvalidDtoError);
    }
  });
});
describe('URL and pagination', () => {
  it('restores search, sorting and filters while ignoring array query injection', () => {
    expect(parseFilters({ q: 'Иван', sort: 'name', tag: 't1,t2', city: ['Москва'] })).toEqual({ q: 'Иван', sort: 'name', tag: 't1,t2', city: '', status: '', category: '' });
    expect(parsePage('-1')).toBe(1);
    expect(parsePage('2.2')).toBe(1);
    expect(parsePage('3')).toBe(3);
  });
  it('keeps first, last and current neighbors in classic pagination', () => {
    expect(paginationItems(5, 12)).toEqual([1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 12]);
    expect(paginationItems(1, 3)).toEqual([1, 2, 3]);
    expect(paginationItems(12, 12)).toEqual([1, 'ellipsis-left', 9, 10, 11, 12]);
  });
});
