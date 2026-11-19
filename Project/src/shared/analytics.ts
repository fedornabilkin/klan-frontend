import type { Activity, ListMeta, User } from './contracts.js';

export interface AnalyticsRange { from: string; to: string; days: number; timezone: 'UTC' }
export interface AnalyticsCount { name: string; count: number }
export interface AnalyticsMember {
  user: Pick<User, 'id' | 'publicId' | 'name' | 'initials' | 'color' | 'role' | 'joinedAt' | 'location'>;
  period: { actions: number; activeDays: number; resultEntries: number };
  lastRecordedActivity: string | null;
  profileCompleteness: number;
  current: { events: number; challenges: number; teams: number; books: number; achievements: number };
}
export interface AnalyticsParticipation { id: string; publicId?: number; title: string; status: string; participants: number; start?: string; end?: string }
export interface AnalyticsChallenge {
  id: string; publicId?: number; title: string; unit: string; participants: number;
  periodEntries: number; periodContributors: number; periodValue: number; totalValue: number;
}
export interface CommunityAnalytics {
  range: AnalyticsRange;
  coverage: { firstRecordedActivity: string | null; lastRecordedActivity: string | null; storedActions: number };
  period: { actions: number; activeMembers: number; inactiveMembers: number; activeMemberPercent: number; newMembers: number; resultEntries: number; resultContributors: number };
  current: { members: number; cities: number; countries: number; activeTeams: number; eventRegistrations: number; challengeRegistrations: number; bookReadMarks: number; averageProfileCompleteness: number };
  daily: { date: string; actions: number; activeMembers: number; newMembers: number }[];
  actions: AnalyticsCount[];
  geography: AnalyticsCount[];
  interests: AnalyticsCount[];
  teams: AnalyticsParticipation[];
  events: AnalyticsParticipation[];
  challenges: AnalyticsChallenge[];
}
export interface AnalyticsMembers { data: AnalyticsMember[]; meta: ListMeta; range: AnalyticsRange }
export interface MemberAnalytics {
  range: AnalyticsRange;
  member: AnalyticsMember;
  profileFields: { label: string; filled: boolean }[];
  participation: { id: string; publicId?: number; type: string; title: string; status: string; start?: string; end?: string }[];
  challenges: AnalyticsChallenge[];
  actions: AnalyticsCount[];
  activity: { data: Activity[]; meta: ListMeta };
}
