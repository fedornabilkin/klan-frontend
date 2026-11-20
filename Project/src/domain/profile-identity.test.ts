import { describe, expect, it } from 'vitest';
import { identityDraft, identityPatch, identitySavedFields } from './profile-identity';

describe('profile identity editing', () => {
  it('prefills the simple legacy first/last convention without persisting inferred parts', () => {
    const { draft, legacyName } = identityDraft({ name: 'Роман Смирнов' });
    expect(legacyName).toBe(true);
    expect(draft).toMatchObject({ firstName: 'Роман', lastName: 'Смирнов', middleName: '' });
    expect(identityPatch({ ...draft, callsign: 'Фёдор Набилкин' }, draft)).toEqual({ callsign: 'Фёдор Набилкин' });
    expect(identityPatch(draft, draft)).toEqual({});
  });
  it('keeps ambiguous legacy names intact until the user explicitly distributes the parts', () => {
    for (const name of ['Петров Иван Иванович', 'Иван [Сокол] Петров', 'Анна Мария ван дер Берг']) {
      const state = identityDraft({ name });
      expect(state.ambiguousName).toBe(true);
      expect(state.draft.firstName).toBe(name);
      expect(state.draft.lastName).toBe('');
      expect(identityPatch({ ...state.draft, birthDate: '1990-01-01' }, state.draft)).toEqual({ birthDate: '1990-01-01' });
    }
  });
  it('uses authoritative structured parts and submits them together only when changed', () => {
    const { draft } = identityDraft({ name: 'Иван Иванович Петров', firstName: 'Иван', lastName: 'Петров', middleName: 'Иванович' });
    const patch = identityPatch({ ...draft, lastName: 'Сидоров' }, draft);
    expect(patch).toEqual({ firstName: 'Иван', lastName: 'Сидоров', middleName: 'Иванович' });
    expect(identitySavedFields(patch)).toEqual(expect.arrayContaining(['name', 'initials', 'firstName', 'lastName', 'middleName']));
    expect(identitySavedFields({ callsign: 'Сокол' })).toEqual(['callsign']);
    expect(() => identityPatch({ ...draft, firstName: ' ' }, draft)).toThrow('Укажите имя');
  });
  it('normalizes and clears contact data without touching the Telegram authentication binding', () => {
    const { draft } = identityDraft({ name: 'Роман Смирнов', username: 'fedornabilkin', birthDate: '1990-01-01' });
    expect(identityPatch({ ...draft, username: '@fedornabilkin' }, draft)).toEqual({});
    expect(identityPatch({ ...draft, username: ' @new_username ' }, draft)).toEqual({ username: 'new_username' });
    expect(identityPatch({ ...draft, username: '', birthDate: '' }, draft)).toEqual({ username: null, birthDate: null });
    expect(() => identityPatch({ ...draft, username: 'https://t.me/example' }, draft)).toThrow('Username Telegram');
  });
  it('saves and clears the actual membership date independently', () => {
    const { draft } = identityDraft({ name:'Иван Петров' });
    const changed = { ...draft, clanJoinedOn:'2016-02-29' };
    expect(draft.clanJoinedOn).toBe('');
    expect(identityPatch(changed, draft)).toEqual({clanJoinedOn:'2016-02-29'});
    expect(identityPatch(draft, changed)).toEqual({clanJoinedOn:null});
    for (const clanJoinedOn of ['2010-02-29','9999-12-31'])
      expect(() => identityPatch({ ...draft, clanJoinedOn },draft)).toThrow('дату вступления');
  });
  it('accepts a leap-day birthday and rejects invalid or future dates', () => {
    const { draft } = identityDraft({ name: 'Иван Петров' });
    expect(identityPatch({ ...draft, birthDate: '2000-02-29' }, draft, '2026-11-13')).toEqual({ birthDate: '2000-02-29' });
    for (const birthDate of ['2001-02-29', '2026-11-14', '01.01.2000']) {
      expect(() => identityPatch({ ...draft, birthDate }, draft, '2026-11-13')).toThrow('дату рождения');
    }
  });
});
