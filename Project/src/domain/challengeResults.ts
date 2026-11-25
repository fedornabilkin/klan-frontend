import type { Entity, Participation, User } from '@shared/contracts';

const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const names = new Intl.Collator('ru', { numeric: true });
const dayMs = 86_400_000;

type ChallengeEntry = Pick<Participation, 'user' | 'team'>;

export function resultPeriod(entity: Pick<Entity, 'schedule' | 'status'> | undefined, now: Date) {
  const schedule = entity?.schedule;
  const today = now.toISOString().slice(0, 10);
  const first = schedule?.start.slice(0, 10) ?? '';
  const end = schedule?.end.slice(0, 10) ?? '';
  const started = !!schedule && Date.parse(schedule.start) <= now.getTime();
  const open = !!entity && !!schedule && started && Date.parse(schedule.end) > now.getTime()
    && !['completed','archived','closed','draft'].includes(entity.status);
  return {first, last:end < today ? end : today, started, open};
}

export function resultInputLimits(category: string) {
  return {min:0, max:category === 'attendance' ? 1 : 1e7, step:category === 'distance' ? 0.01 : 1};
}

export interface SavedChallengeDay { date: string; value: number }

export function challengeTeamOptions(entity: Pick<Entity, 'participants' | 'results' | 'pendingResults'>) {
  const teams = new Map<string, string>();
  let hasSolo = false;
  for (const entries of [entity.participants, entity.results ?? [], entity.pendingResults ?? []]) {
    for (const { team } of entries) {
      if (team) teams.set(team.id, team.title);
      else hasSolo = true;
    }
  }
  const options = [...teams].map(([value, label]) => ({ value, label })).sort((a, b) => names.compare(a.label, b.label));
  if (hasSolo) options.push({ value: '', label: 'Без команды' });
  return options;
}

function fold(text: string) {
  return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е');
}

export function challengeResultMatcher(teamId: string | null, query: string) {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  const people = new WeakMap<User, boolean>();
  return ({ user, team }: ChallengeEntry) => {
    if (teamId !== null && (team?.id ?? '') !== teamId) return false;
    if (!words.length) return true;
    const cached = people.get(user);
    if (cached !== undefined) return cached;
    const text = fold([user.name, user.firstName, user.lastName, user.callsign,
      user.username && '@' + user.username.replace(/^@/, '')].filter(Boolean).join(' '));
    const matches = words.every(word => text.includes(word));
    people.set(user, matches);
    return matches;
  };
}

export function challengeCalendar(entity: Pick<Entity, 'schedule' | 'participants' | 'results'>, today: string,
  matches: (row: ChallengeEntry) => boolean = () => true) {
  const rows = new Map<string, { user: User; values: Map<string, number> }>();
  const results = entity.results ?? [];
  let first = '', last = '', total = 0, count = 0;
  function includeDate(value?: string) {
    const date = value?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (!first || date < first) first = date;
    if (date > last) last = date;
  }
  function rowFor(user: User) {
    let row = rows.get(user.id);
    if (!row) {
      row = { user, values: new Map<string, number>() };
      rows.set(user.id, row);
    }
    return row;
  }
  includeDate(entity.schedule?.start);
  includeDate(entity.schedule?.end);
  for (const participant of entity.participants) {
    if (matches(participant)) rowFor(participant.user);
  }
  for (const result of results) {
    includeDate(result.date);
    if (!matches(result)) continue;
    count++;
    const values = rowFor(result.user).values;
    values.set(result.date, (values.get(result.date) ?? 0) + result.value);
    total += result.value;
  }
  if (!first) includeDate(today);
  const start = Date.parse(first.slice(0, 7) + '-01T00:00:00Z');
  const end = new Date(last.slice(0, 7) + '-01T00:00:00Z');
  end.setUTCMonth(end.getUTCMonth() + 1);
  const days: string[] = [], months: { key: string; label: string; count: number }[] = [];
  for (let time = start; time < end.getTime(); time += dayMs) {
    const date = new Date(time), iso = date.toISOString().slice(0, 10);
    if (date.getUTCDate() === 1) months.push({ key: iso.slice(0, 7), label: monthLabel.format(date), count: 0 });
    months[months.length - 1]!.count++;
    days.push(iso);
  }
  return { days, months, total, count,
    rows: [...rows.values()].sort((a, b) => names.compare(a.user.name, b.user.name) || a.user.id.localeCompare(b.user.id)) };
}

/** Totals cover every row, even when only one page is rendered. */
export function paginateChallengeResults<T extends { value: number }>(results: readonly T[], requestedPage: number, size = 25) {
  const pageSize = Number.isSafeInteger(size) && size > 0 ? size : 25;
  const total = results.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const offset = (page - 1) * pageSize;
  return {
    rows: results.slice(offset, offset + pageSize), page, pages, total,
    value: results.reduce((sum, result) => sum + result.value, 0),
    first: total ? offset + 1 : 0,
    last: Math.min(total, offset + pageSize),
  };
}
