/** Telegram handles are display/contact data; authentication uses the bound numeric Telegram ID. */
export function normalizeTelegramUsername(value: string): string {
  return value.trim().replace(/^@/, '');
}

export function formatProfileName(parts: { firstName: string; middleName: string; lastName: string }): string {
  return [parts.firstName, parts.middleName, parts.lastName].map(value => value.trim()).filter(Boolean).join(' ');
}

export function latestProfileDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
