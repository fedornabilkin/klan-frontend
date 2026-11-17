import type { AccessSummary } from './access.js';

export type Resource = 'users' | 'events' | 'teams' | 'challenges' | 'news' | 'feedback' | 'books' | 'rules';
export interface Tag { id: string; name: string }
export interface Location { city: string; country: string; lat: number | null; lng: number | null }
export interface ProfileEntry { id: string; text: string; date: string | null }
/** Old stored profiles and version-1 exports may still contain plain strings. */
export type ProfileEntryInput = string | ProfileEntry;
export interface ProfileTeamSummary { id: string; title: string; description: string; memberCount: number }
export interface User {
  id: string; name: string; username?: string; role: 'admin' | 'member';
  firstName?: string; lastName?: string; middleName?: string; birthDate?: string | null;
  callsign?: string;
  activeTeams?: ProfileTeamSummary[];
  publicId?: number;
  access?: AccessSummary;
  bio: string; location: Location; tags: Tag[]; initials: string; color: string;
  facts: ProfileEntryInput[]; interests: string[]; achievements: ProfileEntryInput[];
  stats: { events: number; challenges: number; books: number }; joinedAt: string;
}
export interface Item { id: string; name: string; quantity?: number }
export interface Participation { user: User; team?: { id: string; title: string }; items?: Item[]; target?: number }
export interface ChallengeResult { user: User; date: string; value: number; team?: { id: string; title: string } }
/** Imported values without a confirmed date are excluded from all result totals. */
export interface ChallengePendingResult { user: User; value: number; team?: { id: string; title: string }; sourceCell: string; reason: string }
export interface Entity {
  id: string; type: Exclude<Resource, 'users'>; title: string; description: string;
  status: string; category: string; tags: Tag[]; createdAt: string;
  location?: Location; schedule?: { start: string; end: string }; cover?: string;
  participants: Participation[]; author?: User; motto?: string; content?: string;
  goal?: { target: number; unit: string }; results?: ChallengeResult[];
  pendingResults?: ChallengePendingResult[];
  readers?: User[]; capacity?: number;
}
export interface Activity { id: string; actor: Pick<User, 'id'|'publicId'|'name'|'initials'|'color'|'role'>; action: string; target?: { title: string; path: string }; createdAt: string }
export interface ListMeta { page: number; limit: number; total: number; pages: number }
export interface ListResponse<T> { data: T[]; meta: ListMeta }
export interface ApiResponse<T> { data: T }
export interface Dashboard {
  stats: { users: number; cities: number; events: number; challenges: number; teams: number };
  events: Entity[]; challenges: Entity[]; teams: Entity[]; activity: Activity[];
}
export interface Statistics {
  users: number; cities: { name: string; count: number }[]; interests: { name: string; count: number }[];
  teams: { id: string; title: string; count: number }[]; achievements: { name: string; count: number }[];
  activity: { date: string; count: number }[];
}
