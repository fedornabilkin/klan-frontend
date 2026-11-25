export const memberFilters = [
  { key: 'telegram', label: 'Без привязки Telegram' },
  { key: 'login', label: 'Ни разу не заходил' },
  { key: 'city', label: 'Без города' },
  { key: 'tags', label: 'Без тегов' },
  { key: 'bio', label: 'Без описания' },
  { key: 'facts', label: 'Без фактов' },
  { key: 'achievements', label: 'Без достижений' },
  { key: 'teams', label: 'Никогда не состоял в команде' },
  { key: 'results', label: 'Без результатов в челленджах' },
] as const;
export type MemberFilterKey = typeof memberFilters[number]['key'];

export function selectedMemberFilters(value: string): MemberFilterKey[] {
  const keys = new Set(value.split(','));
  return memberFilters.map(filter => filter.key).filter(key => keys.has(key));
}
