import type { User } from './contracts.js';

/** Public profile URLs are separate from internal IDs used by mutations and ownership checks. */
export function userPath(user: Pick<User, 'id' | 'publicId'>): string {
  const id = user.publicId;
  return `/users/${typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : encodeURIComponent(user.id)}`;
}
