import type { ChallengePendingResult, ChallengeResult } from '@shared/contracts';

export const SOLO_RESULT_TEAM = '__solo__';

export interface ChallengeResultFilters {
  userId?: string | null;
  teamId?: string | null;
  from?: string;
  to?: string;
}

/** Filter the historical team on each result, not the user's current team. */
export function filterChallengeResults(results: readonly ChallengeResult[], filters: ChallengeResultFilters): ChallengeResult[] {
  return results.filter(result =>
    (!filters.userId || result.user.id === filters.userId)
    && (!filters.teamId || (result.team?.id ?? SOLO_RESULT_TEAM) === filters.teamId)
    && (!filters.from || result.date >= filters.from)
    && (!filters.to || result.date <= filters.to),
  ).sort((left, right) => right.date.localeCompare(left.date)
    || left.user.name.localeCompare(right.user.name, 'ru')
    || left.user.id.localeCompare(right.user.id)
    || (left.team?.id ?? '').localeCompare(right.team?.id ?? ''));
}

/** Totals cover every filtered row, even when only one page is rendered. */
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

/** Unresolved rows have no date, so a date range must never silently classify them. */
export function filterPendingChallengeResults(results: readonly ChallengePendingResult[], filters: Pick<ChallengeResultFilters, 'userId' | 'teamId'>): ChallengePendingResult[] {
  return results.filter(result => (!filters.userId || result.user.id === filters.userId)
    && (!filters.teamId || (result.team?.id ?? SOLO_RESULT_TEAM) === filters.teamId))
    .sort((left, right) => left.user.name.localeCompare(right.user.name, 'ru')
      || left.user.id.localeCompare(right.user.id)
      || left.sourceCell.localeCompare(right.sourceCell, 'ru', { numeric: true }));
}

/** A result is a calendar day, not a timestamp to shift into the viewer's zone. */
export function resultDateLabel(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}
