import type { User } from '@shared/contracts';
import { isCalendarDate } from '@shared/profile-entries';
import { formatProfileName, latestProfileDate, normalizeTelegramUsername } from '@shared/profile-identity';

export function displayProfileName(user: Pick<User, 'firstName' | 'lastName' | 'name'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
}

export interface IdentityDraft {
  firstName: string;
  lastName: string;
  middleName: string;
  callsign: string;
  username: string;
  birthDate: string;
  clanJoinedOn: string;
}
export type IdentityPatch = Partial<Omit<IdentityDraft, 'birthDate' | 'clanJoinedOn' | 'username'>> & {
  birthDate?: string | null;
  clanJoinedOn?: string | null;
  username?: string | null;
};
export type IdentitySavedField = keyof IdentityDraft | 'name' | 'initials';

export function identityDraft(user: Pick<User, 'name' | keyof IdentityDraft>): { draft: IdentityDraft; legacyName: boolean; ambiguousName: boolean } {
  const legacyName = user.firstName == null;
  const words = user.name.trim().split(/\s+/);
  // Only the known simple legacy convention is prefilled. Keep ambiguous names
  // intact, and never persist inferred parts unless the user actually edits them.
  const simpleName = words.length === 2 && words.every(word => /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(word));
  return {
    legacyName,
    ambiguousName: legacyName && !simpleName && words.length > 1,
    draft: {
      firstName: legacyName ? (simpleName ? words[0]! : user.name) : user.firstName!,
      lastName: legacyName ? (simpleName ? words[1]! : '') : user.lastName || '',
      middleName: legacyName ? '' : user.middleName || '',
      callsign: user.callsign || '',
      username: user.username || '',
      birthDate: user.birthDate || '',
      clanJoinedOn: user.clanJoinedOn || '',
    },
  };
}

export function identityPatch(draft: IdentityDraft, original: IdentityDraft, today = latestProfileDate()): IdentityPatch {
  const patch: IdentityPatch = {};
  const nameFields = ['firstName', 'lastName', 'middleName'] as const;
  if (nameFields.some(field => draft[field].trim() !== original[field].trim())) {
    const parts = { firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), middleName: draft.middleName.trim() };
    if (!parts.firstName) throw new Error('Укажите имя.');
    if (formatProfileName(parts).length > 120) throw new Error('ФИО должно содержать не более 120 символов.');
    Object.assign(patch, parts);
  }
  if (draft.callsign.trim() !== original.callsign.trim()) {
    if (draft.callsign.trim().length > 120) throw new Error('Позывной должен содержать не более 120 символов.');
    patch.callsign = draft.callsign.trim();
  }
  const username = normalizeTelegramUsername(draft.username);
  if (username !== normalizeTelegramUsername(original.username)) {
    if (username && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) throw new Error('Username Telegram: от 5 до 32 латинских букв, цифр или знаков подчёркивания; первый символ — буква.');
    patch.username = username || null;
  }
  if (draft.birthDate !== original.birthDate) {
    if (draft.birthDate && (!isCalendarDate(draft.birthDate) || draft.birthDate > today)) throw new Error('Укажите существующую дату рождения, не позднее сегодняшнего дня, или оставьте поле пустым.');
    patch.birthDate = draft.birthDate || null;
  }
  if (draft.clanJoinedOn !== original.clanJoinedOn) {
    if (draft.clanJoinedOn && (!isCalendarDate(draft.clanJoinedOn) || draft.clanJoinedOn > today)) throw new Error('Укажите дату вступления в Клан не позднее сегодняшнего дня.');
    patch.clanJoinedOn = draft.clanJoinedOn || null;
  }
  return patch;
}

export function identitySavedFields(patch: IdentityPatch): IdentitySavedField[] {
  const fields = Object.keys(patch) as IdentitySavedField[];
  return patch.firstName === undefined ? fields : [...fields, 'name', 'initials'];
}
