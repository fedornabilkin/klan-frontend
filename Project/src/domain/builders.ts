import type { Activity, ChallengePendingResult, ChallengeResult, Entity, Item, Location, Participation, ProfileEntry, ProfileEntryInput, ProfileTeamSummary, Resource, Tag, User } from '@shared/contracts';
import { accessLevels, capabilities, type AccessSummary } from '@shared/access';
import { isCalendarDate, normalizeProfileEntries } from '@shared/profile-entries';

type Dict = Record<string, unknown>;
export class InvalidDtoError extends Error {
  constructor(field: string) { super(`Некорректные данные сервера: ${field}`); this.name = 'InvalidDtoError'; }
}
export function object(value: unknown, field = 'object'): Dict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidDtoError(field);
  return value as Dict;
}
function string(value: unknown, field: string, fallback?: string): string {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'string') throw new InvalidDtoError(field);
  return value;
}
function number(value: unknown, field: string, fallback?: number): number {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new InvalidDtoError(field);
  return value;
}
function array<T>(value: unknown, parse: (v: unknown) => T, field: string): T[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new InvalidDtoError(field);
  return value.map(parse);
}
const strings = (value: unknown, field: string) => array(value, v => string(v, field), field);
function publicId(value: unknown, field: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new InvalidDtoError(field);
  return value;
}
function birthDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !isCalendarDate(value) || value > new Date().toISOString().slice(0, 10)) throw new InvalidDtoError('user.birthDate');
  return value;
}
function buildProfileTeam(value: unknown): ProfileTeamSummary {
  const dto = object(value, 'user.activeTeams');
  const memberCount = number(dto.memberCount, 'user.activeTeams.memberCount');
  if (!Number.isSafeInteger(memberCount) || memberCount < 0) throw new InvalidDtoError('user.activeTeams.memberCount');
  return {
    id: string(dto.id, 'user.activeTeams.id'), ...(dto.publicId != null && { publicId: publicId(dto.publicId,'user.activeTeams.publicId') }), title: string(dto.title, 'user.activeTeams.title'),
    description: string(dto.description, 'user.activeTeams.description', ''), memberCount,
  };
}
function profileEntries(value: unknown, field: string, scope: string): ProfileEntry[] {
  const entries = array<ProfileEntryInput>(value, entry => {
    if (typeof entry === 'string') return entry;
    const dto = object(entry, field);
    const id = string(dto.id, `${field}.id`);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)) throw new InvalidDtoError(`${field}.id`);
    const date = dto.date === null ? null : string(dto.date, `${field}.date`);
    if (date !== null && !isCalendarDate(date)) throw new InvalidDtoError(`${field}.date`);
    return { id, text: string(dto.text, `${field}.text`), date };
  }, field);
  const result = normalizeProfileEntries(entries, scope);
  if (new Set(result.map(entry => entry.id)).size !== result.length) throw new InvalidDtoError(`${field}.id`);
  return result;
}
function buildAccess(value: unknown): AccessSummary | undefined {
  if (value == null) return undefined;
  const dto = object(value, 'user.access');
  if (!accessLevels.includes(dto.level as AccessSummary['level'])) throw new InvalidDtoError('user.access.level');
  if (dto.source !== 'telegram' && dto.source !== 'demo') throw new InvalidDtoError('user.access.source');
  const grants = strings(dto.capabilities, 'user.access.capabilities');
  if (grants.some(grant => !capabilities.includes(grant as AccessSummary['capabilities'][number]))) throw new InvalidDtoError('user.access.capabilities');
  return { level: dto.level as AccessSummary['level'], source: dto.source, capabilities: [...new Set(grants)] as AccessSummary['capabilities'] };
}
export function buildTag(value: unknown): Tag {
  const dto = object(value, 'tag');
  return { id: string(dto.id, 'tag.id'), name: string(dto.name, 'tag.name') };
}
function buildLocation(value: unknown): Location {
  const dto = object(value, 'location');
  const lat = dto.lat == null ? null : number(dto.lat, 'location.lat');
  const lng = dto.lng == null ? null : number(dto.lng, 'location.lng');
  if ((lat === null) !== (lng === null) || (lat !== null && (lat < -90 || lat > 90))
    || (lng !== null && (lng < -180 || lng > 180))) throw new InvalidDtoError('location.coordinates');
  return { city: string(dto.city, 'location.city').trim(), country: string(dto.country, 'location.country').trim(), lat, lng };
}

export class UserModel implements User {
  id!: string; publicId?: number; name!: string; username?: string; callsign?: string; role!: User['role']; bio!: string;
  firstName?: string; lastName?: string; middleName?: string; birthDate!: string | null; activeTeams!: ProfileTeamSummary[]; hasActiveTeam?: boolean;
  location!: Location; tags!: Tag[]; initials!: string; color!: string;
  facts!: ProfileEntry[]; interests!: string[]; achievements!: ProfileEntry[];
  stats!: User['stats']; joinedAt!: string;
  access?: AccessSummary;
  constructor(data: User) { Object.assign(this, data); }
  get displayName(): string { return this.name; }
  get isAdmin(): boolean { return this.role === 'admin'; }
  get place(): string { return [this.location.city, this.location.country].filter(Boolean).join(', '); }
}

export class UserBuilder {
  private dto: unknown;
  from(dto: unknown): this { this.dto = dto; return this; }
  build(): UserModel {
    const dto = object(this.dto, 'user');
    const role = string(dto.role, 'user.role');
    if (role !== 'admin' && role !== 'member') throw new InvalidDtoError('user.role');
    const stats = object(dto.stats ?? {}, 'user.stats');
    const id = string(dto.id, 'user.id');
    const name = string(dto.name, 'user.name');
    return new UserModel({
      id, publicId: publicId(dto.publicId, 'user.publicId'), name, role,
      access: buildAccess(dto.access),
      username: dto.username == null ? undefined : string(dto.username, 'user.username'),
      callsign: dto.callsign == null ? undefined : string(dto.callsign, 'user.callsign'),
      firstName: dto.firstName == null ? undefined : string(dto.firstName, 'user.firstName'),
      lastName: dto.lastName == null ? undefined : string(dto.lastName, 'user.lastName'),
      middleName: dto.middleName == null ? undefined : string(dto.middleName, 'user.middleName'),
      hasActiveTeam: typeof dto.hasActiveTeam === 'boolean' ? dto.hasActiveTeam : undefined,
      birthDate: birthDate(dto.birthDate), activeTeams: array(dto.activeTeams, buildProfileTeam, 'user.activeTeams'),
      bio: string(dto.bio, 'user.bio', ''), location: buildLocation(dto.location),
      tags: array(dto.tags, buildTag, 'user.tags'),
      initials: string(dto.initials, 'user.initials', name.split(' ').map(v => v[0]).slice(0, 2).join('')),
      color: string(dto.color, 'user.color', '#b57439'), facts: profileEntries(dto.facts, 'user.facts', `${id}:facts`),
      interests: strings(dto.interests, 'user.interests'), achievements: profileEntries(dto.achievements, 'user.achievements', `${id}:achievements`),
      stats: { events: number(stats.events, 'stats.events', 0), challenges: number(stats.challenges, 'stats.challenges', 0), books: number(stats.books, 'stats.books', 0) },
      joinedAt: string(dto.joinedAt, 'user.joinedAt', ''),
    });
  }
}

function buildItem(value: unknown): Item {
  const dto = object(value, 'item');
  return { id: string(dto.id, 'item.id'), name: string(dto.name, 'item.name'), quantity: dto.quantity == null ? undefined : number(dto.quantity, 'item.quantity') };
}
function buildTeam(value: unknown): { id: string; publicId?: number; title: string } | undefined {
  if (value == null) return undefined;
  const dto = object(value, 'team');
  return { id: string(dto.id, 'team.id'), publicId: publicId(dto.publicId, 'team.publicId'), title: string(dto.title, 'team.title') };
}
function buildParticipation(value: unknown, person: (value: unknown) => User, team: typeof buildTeam): Participation {
  const dto = object(value, 'participant');
  const target = dto.target == null ? undefined : number(dto.target, 'participant.target');
  if (target !== undefined && target < 0) throw new InvalidDtoError('participant.target');
  return { user: person(dto.user), team: team(dto.team), items: array(dto.items, buildItem, 'participant.items'), target };
}
function buildResult(value: unknown, person: (value: unknown) => User, team: typeof buildTeam): ChallengeResult {
  const dto = object(value, 'result');
  return { user: person(dto.user), date: string(dto.date, 'result.date'), value: number(dto.value, 'result.value'), team: team(dto.team) };
}
function buildPendingResult(value: unknown, person: (value: unknown) => User, team: typeof buildTeam): ChallengePendingResult {
  const dto = object(value, 'pendingResult');
  const amount = number(dto.value, 'pendingResult.value');
  const sourceCell = string(dto.sourceCell, 'pendingResult.sourceCell');
  const reason = string(dto.reason, 'pendingResult.reason');
  if (amount < 0) throw new InvalidDtoError('pendingResult.value');
  if (!sourceCell.trim() || !reason.trim()) throw new InvalidDtoError('pendingResult.source');
  return { user: person(dto.user), value: amount, team: team(dto.team), sourceCell, reason };
}

export class CommunityEntity implements Entity {
  id!: string; type!: Entity['type']; title!: string; description!: string; status!: string; category!: string;
  tags!: Tag[]; createdAt!: string; location?: Location; schedule?: Entity['schedule']; cover?: string;
  challengeTeams?: NonNullable<Participation['team']>[];
  participants!: Participation[]; author?: User; motto?: string; content?: string; goal?: Entity['goal'];
  results?: ChallengeResult[]; pendingResults?: ChallengePendingResult[]; readers?: User[]; capacity?: number;
  constructor(data: Entity) { Object.assign(this, data); }
  get displayName(): string { return this.title; }
  publicId?: number; participantCount?: number; readerCount?: number;
  get memberCount(): number { return this.participantCount ?? this.participants.length; }
  get isActive(): boolean { return this.status === 'active'; }
  hasParticipant(userId: string): boolean { return this.participants.some(p => p.user.id === userId); }
}

const entityTypes = new Set(['events', 'teams', 'challenges', 'news', 'feedback', 'books', 'rules']);
export class EntityBuilder {
  private dto: unknown;
  from(dto: unknown): this { this.dto = dto; return this; }
  build(): CommunityEntity {
    const dto = object(this.dto, 'entity');
    const type = string(dto.type, 'entity.type');
    if (!entityTypes.has(type)) throw new InvalidDtoError('entity.type');
    const schedule = dto.schedule == null ? undefined : object(dto.schedule, 'schedule');
    const goal = dto.goal == null ? undefined : object(dto.goal, 'goal');
    const people = array(dto.people, value => new UserBuilder().from(value).build(), 'people');
    const teams = array(dto.teams, buildTeam, 'teams');
    function person(value: unknown): User {
      if (typeof value !== 'number') return new UserBuilder().from(value).build();
      const user = people[value];
      if (!user) throw new InvalidDtoError('entity.people');
      return user;
    }
    function team(value: unknown) {
      if (typeof value !== 'number') return buildTeam(value);
      const entry = teams[value];
      if (!entry) throw new InvalidDtoError('entity.teams');
      return entry;
    }
    return new CommunityEntity({
      id: string(dto.id, 'entity.id'), publicId: publicId(dto.publicId, 'entity.publicId'), participantCount: dto.participantCount == null ? undefined : number(dto.participantCount, 'participantCount'), readerCount: dto.readerCount == null ? undefined : number(dto.readerCount, 'readerCount'), type: type as Entity['type'], title: string(dto.title, 'entity.title'),
      description: string(dto.description, 'entity.description', ''), status: string(dto.status, 'entity.status', 'active'),
      category: string(dto.category, 'entity.category', ''), tags: array(dto.tags, buildTag, 'entity.tags'),
      createdAt: string(dto.createdAt, 'entity.createdAt', ''),
      location: dto.location == null ? undefined : buildLocation(dto.location),
      schedule: schedule ? { start: string(schedule.start, 'schedule.start'), end: string(schedule.end, 'schedule.end') } : undefined,
      cover: dto.cover == null ? undefined : string(dto.cover, 'entity.cover'),
      challengeTeams: type === 'challenges' ? teams.filter((t): t is NonNullable<typeof t> => !!t) : undefined,
      participants: array(dto.participants, value => buildParticipation(value, person, team), 'participants'),
      author: dto.author == null ? undefined : person(dto.author),
      motto: dto.motto == null ? undefined : string(dto.motto, 'motto'), content: dto.content == null ? undefined : string(dto.content, 'content'),
      goal: goal ? { target: number(goal.target, 'goal.target'), unit: string(goal.unit, 'goal.unit'), ...(goal.scope === 'participant' && {scope:'participant' as const}) } : undefined,
      results: array(dto.results, value => buildResult(value, person, team), 'results'), readers: array(dto.readers, person, 'readers'),
      pendingResults: array(dto.pendingResults, value => buildPendingResult(value, person, team), 'pendingResults'),
      capacity: dto.capacity == null ? undefined : number(dto.capacity, 'capacity'),
    });
  }
}
export function buildResource(resource: Resource, dto: unknown): UserModel | CommunityEntity {
  return resource === 'users' ? new UserBuilder().from(dto).build() : new EntityBuilder().from(dto).build();
}
function buildIdentity(dto: Record<string, unknown>) {
  return {
    id: string(dto.id, 'user.id'), publicId: publicId(dto.publicId, 'user.publicId'), name: string(dto.name, 'user.name'),
    firstName: typeof dto.firstName === 'string' ? dto.firstName : undefined,
    lastName: typeof dto.lastName === 'string' ? dto.lastName : undefined,
    callsign: typeof dto.callsign === 'string' ? dto.callsign : undefined,
    hasActiveTeam: dto.hasActiveTeam === true,
    initials: string(dto.initials, 'user.initials'), color: string(dto.color, 'user.color'),
  };
}
export function buildActivity(value: unknown): Activity {
  const dto = object(value, 'activity');
  const actor = object(dto.actor, 'activity.actor');
  const target = dto.target == null ? undefined : object(dto.target, 'activity.target');
  const role = string(actor.role, 'actor.role');
  if (role !== 'member' && role !== 'admin') throw new InvalidDtoError('actor.role');
  return {
    id: string(dto.id, 'activity.id'), action: string(dto.action, 'activity.action'), createdAt: string(dto.createdAt, 'activity.createdAt'),
    actor: { ...buildIdentity(actor), role },
    target: target ? { title: string(target.title, 'target.title'), path: string(target.path, 'target.path'),
      user: target.user ? buildIdentity(object(target.user, 'target.user')) : undefined } : undefined,
  };
}
