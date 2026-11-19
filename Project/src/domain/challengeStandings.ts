import type { Entity, Participation, User } from '@shared/contracts';

type Team = NonNullable<Participation['team']>;
const names = new Intl.Collator('ru', {numeric:true});

export function challengeStandings(entity: Entity) {
  const teams = new Map<string,{team:Team; members:number; score:number}>();
  const people = new Map<string,{user:User; team?:Team; score:number}>();
  const registered = new Set<string>();
  function teamRow(team: Team) {
    let row = teams.get(team.id);
    if (!row) {
      row = {team, members:0, score:0};
      teams.set(team.id,row);
    }
    return row;
  }
  for (const team of entity.challengeTeams ?? []) teamRow(team);
  for (const {user,team} of entity.participants) {
    if (registered.has(user.id)) continue;
    registered.add(user.id);
    people.set(user.id,{user,team,score:0});
    if (team) teamRow(team).members++;
  }
  let score = 0;
  for (const result of entity.results ?? []) {
    const row = people.get(result.user.id) ?? {user:result.user, team:result.team, score:0};
    row.score += result.value;
    people.set(result.user.id,row);
    if (result.team) teamRow(result.team).score += result.value;
    score += result.value;
  }
  const perPerson = entity.goal?.target ?? 0;
  return {
    score, target: perPerson * registered.size, members:registered.size,
    teams: [...teams.values()].map(row => ({...row,target:perPerson*row.members}))
      .sort((a,b) => b.score-a.score || names.compare(a.team.title,b.team.title) || a.team.id.localeCompare(b.team.id)),
    people: [...people.values()].sort((a,b) => b.score-a.score || names.compare(a.user.name,b.user.name) || a.user.id.localeCompare(b.user.id)),
  };
}
