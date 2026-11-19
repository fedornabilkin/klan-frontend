<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { challengeStandings } from '@/domain/challengeStandings';
import { userPath } from '@shared/user-links';
import Avatar from '@/components/ui/Avatar.vue';
import Pagination from '@/components/ui/Pagination.vue';

const props = defineProps<{
  standings: ReturnType<typeof challengeStandings>; challengeId: string; unit: string; personalGoal: number; currentUser?: string;
}>();
const pageSize = 10;
const teamPage = ref(1), personPage = ref(1);
const teamPages = computed(() => Math.max(1,Math.ceil(props.standings.teams.length/pageSize)));
const personPages = computed(() => Math.max(1,Math.ceil(props.standings.people.length/pageSize)));
const visibleTeams = computed(() => props.standings.teams.slice((teamPage.value-1)*pageSize,teamPage.value*pageSize));
const visiblePeople = computed(() => props.standings.people.slice((personPage.value-1)*pageSize,personPage.value*pageSize));
watch(() => props.challengeId, () => { teamPage.value=1; personPage.value=1; });
watch(teamPages, count => { teamPage.value=Math.min(teamPage.value,count); });
watch(personPages, count => { personPage.value=Math.min(personPage.value,count); });
const format = (n: number) => n.toLocaleString('ru-RU');
</script>

<template lang="pug">
section.detail-panel(aria-labelledby="team-standings-title")
  .heading
    h2#team-standings-title Командный зачёт
    span Команд: {{ standings.teams.length }}
  .row(v-for="(row,i) in visibleTeams" :key="row.team.id")
    span.place {{ (teamPage-1)*pageSize+i+1 }}
    .identity
      RouterLink(:to="`/teams/${row.team.publicId ?? row.team.id}`") {{ row.team.title }}
      small Участников челленджа: {{ row.members }}
    .score
      strong {{ format(row.score) }} {{ unit }}
      small Цель: {{ format(row.target) }}
  p.empty(v-if="!visibleTeams.length") Команд пока нет.
  Pagination(:page="teamPage" :pages="teamPages" aria-label="Страницы командного зачёта" @change="teamPage=$event")
section.detail-panel(aria-labelledby="personal-standings-title")
  .heading
    h2#personal-standings-title Личный зачёт
    span Участников: {{ standings.people.length }}
  .row(v-for="(row,i) in visiblePeople" :key="row.user.id" :class="{own:row.user.id===currentUser}")
    span.place {{ (personPage-1)*pageSize+i+1 }}
    .identity.person
      Avatar(:user="row.user" size="sm")
      div
        RouterLink(:to="userPath(row.user)") {{ row.user.name }}
        small {{ row.team?.title || 'Соло' }}
    .score
      strong {{ format(row.score) }} {{ unit }}
      small Цель: {{ format(personalGoal) }}
  p.empty(v-if="!visiblePeople.length") В челлендже пока нет участников.
  Pagination(:page="personPage" :pages="personPages" aria-label="Страницы личного зачёта" @change="personPage=$event")
</template>

<style scoped>
.detail-panel { background:var(--surface,#19191b); border:1px solid var(--border,#302e2d); border-radius:1rem; padding:clamp(1rem,3vw,1.6rem); min-width:0 }
.heading,.row,.person { display:flex; align-items:center; gap:.75rem }
.heading { justify-content:space-between; flex-wrap:wrap; margin-bottom:.6rem }
.heading h2 { font-size:1.15rem; margin:0 }
.heading span,small,.place,.empty { color:#aba39c; font-size:.78rem }
.row { padding:.65rem 0; border-top:1px solid #ffffff10; font-variant-numeric:tabular-nums }
.place { min-width:2ch; text-align:right }
.identity { min-width:0; flex:1 }
.identity a { color:inherit; font-weight:600; overflow-wrap:anywhere }
.identity a:hover,.own a { color:#ffad74 }
small { display:block }
.score { text-align:right; flex-shrink:0 }
.score strong { font-size:.94rem }
@media(max-width:32rem) { .person :deep(.avatar) { display:none } .row {gap:.5rem} .score {max-width:42%} }
</style>
