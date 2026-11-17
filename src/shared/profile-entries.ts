import type { ProfileEntry, ProfileEntryInput } from './contracts.js';

export function profileEntryText(entry: ProfileEntryInput): string {
  return typeof entry === 'string' ? entry : entry.text;
}

/** A calendar date, not a timestamp: reject rollovers such as February 30. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Deterministic in Node and browsers. Scope separates profiles and entry kinds;
// occurrence separates repeated identical strings without removing any records.
function legacyId(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

/** Pure lossless read adapter. Validation belongs at API write/DTO boundaries. */
export function normalizeProfileEntries(entries: readonly ProfileEntryInput[] | null | undefined, scope = 'profile'): ProfileEntry[] {
  const occurrences = new Map<string, number>();
  const reserved = new Set((entries ?? []).filter((entry): entry is ProfileEntry => typeof entry !== 'string').map(entry => entry.id));
  return (entries ?? []).map(entry => {
    if (typeof entry !== 'string') return { id: entry.id, text: entry.text, date: entry.date };
    const count = (occurrences.get(entry) ?? 0) + 1;
    occurrences.set(entry, count);
    const base = `legacy-${legacyId(`${scope}\u0000${entry}`)}-${count}`;
    let id = base;
    let suffix = 1;
    while (reserved.has(id)) id = `${base}-${suffix++}`;
    reserved.add(id);
    return { id, text: entry, date: null };
  });
}
