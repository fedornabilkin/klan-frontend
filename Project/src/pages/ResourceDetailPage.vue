<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSkeleton } from 'naive-ui';
import type { ApiResponse, Entity, Resource, User } from '@shared/contracts';
import { userPath } from '@shared/user-links';
import type { IdentitySavedField } from '@/domain/profile-identity';
import { EntityBuilder } from '@/domain/builders';
import { communityService } from '@/services/community';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useRealtime } from '@/composables/useRealtime';
import { detailBreadcrumb } from '@/composables/useDetailBreadcrumb';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import Icon from '@/components/ui/Icon.vue';
import DetailCard from '@/components/features/DetailCard.vue';
import EntityLikeButton from '@/components/features/EntityLikeButton.vue';
import FeedbackStatusActions from '@/components/features/FeedbackStatusActions.vue';
import ChallengeMetric from '@/components/ui/ChallengeMetric.vue';
import ProfileTextEditor from '@/components/features/ProfileTextEditor.vue';
import ProfileIdentityEditor from '@/components/features/ProfileIdentityEditor.vue';
import ProfileLocationEditor from '@/components/features/ProfileLocationEditor.vue';
import ProfileTagsSection from '@/components/features/ProfileTagsSection.vue';
import ProfileEntriesSection from '@/components/features/ProfileEntriesSection.vue';
import EntityEditorModal from '@/components/features/EntityEditorModal.vue';
import EventItemsModal from '@/components/features/EventItemsModal.vue';
import ChallengeJoinModal from '@/components/features/ChallengeJoinModal.vue';
import ChallengeResultModal from '@/components/features/ChallengeResultModal.vue';
import { challengeStandings } from '@/domain/challengeStandings';
import TeamChallengeProgress from '@/components/features/TeamChallengeProgress.vue';
import TeamRoster from '@/components/features/TeamRoster.vue';
import ChallengeStandings from '@/components/features/ChallengeStandings.vue';
import ChallengeResultsSection from '@/components/features/ChallengeResultsSection.vue';
import ReadersModal from '@/components/features/ReadersModal.vue';
import { categoryLabels, dateLabel, resourceMeta } from '@/components/features/resourceMeta';

const route=useRoute();const router=useRouter();const auth=useAuthStore();
const resource=computed(()=>(route.meta.resource||route.path.split('/')[1]) as Resource);const id=computed(()=>String(route.params.id));
const record=shallowRef<User|Entity|null>(null);const loading=ref(true);const error=ref('');const refreshError=ref('');const actionError=ref('');const busy=ref(false);
const showEditor=ref(false);const showItems=ref(false);const showJoin=ref(false);const showResult=ref(false);const showReaders=ref(false);
const user=computed(()=>record.value as User);const entity=computed(()=>record.value as Entity);
const isOwn=computed(()=>resource.value==='users'&&record.value?.id===auth.user?.id);
const participant=computed(()=>resource.value==='users'?undefined:entity.value?.participants.find(p=>p.user.id===auth.user?.id));
const canEdit=computed(()=>auth.can('content.manage')||(resource.value==='feedback'&&entity.value?.author?.id===auth.user?.id));
const hasRead=computed(()=>entity.value?.readers?.some(u=>u.id===auth.user?.id)||false);
const ended=computed(()=>entity.value?.status==='archived'||entity.value?.status==='completed'||(entity.value?.schedule?new Date(entity.value.schedule.end).getTime()<Date.now():false));
const eventFull = computed(() => resource.value === 'events' && entity.value?.capacity != null && entity.value.participants.length >= entity.value.capacity);
const started=computed(()=>!entity.value?.schedule || entity.value.schedule.start.slice(0,10)<=new Date().toISOString().slice(0,10));
const standings=computed(()=>challengeStandings(entity.value));
function feedbackStatusChanged(itemId: string, status: string) {
  if (resource.value === 'feedback' && record.value?.id === itemId) {
    controller?.abort();
    record.value = {...entity.value, status};
  }
}
const ownTotal=computed(()=>standings.value.people.find(row=>row.user.id===auth.user?.id)?.score ?? 0);
let controller:AbortController|undefined;
async function load(){
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  loading.value=!record.value;error.value='';refreshError.value='';
  try{
    const result=await communityService.get(resource.value,id.value,signal);if(signal.aborted)return;record.value=result;
    if(result.publicId && String(result.publicId)!==id.value) {
      await router.replace({path:`/${resource.value}/${result.publicId}`,query:route.query,hash:route.hash});
    }
  }catch(cause){
    if(!signal.aborted){const message=cause instanceof Error?cause.message:'Не удалось открыть страницу';if(record.value)refreshError.value=message;else error.value=message;}
  }finally{if(!signal.aborted)loading.value=false;}
}
function profileSaved(savedUser:User,field:'bio'|'location'|'tags'|'facts'|'achievements'){
  const changes={ [field]:savedUser[field] };
  if(resource.value==='users'&&record.value?.id===savedUser.id){controller?.abort();record.value={...record.value,...changes} as User;loading.value=false;error.value='';refreshError.value='';}
  if(auth.user?.id===savedUser.id)auth.setUser({...auth.user,...changes});
}
function profileIdentitySaved(savedUser:User,fields:IdentitySavedField[]){
  // Apply only submitted identity fields: another block or a realtime refresh may
  // already contain newer profile data. Keep session-only demo access and role.
  const changes=Object.fromEntries(fields.map(field=>[field,savedUser[field]]));
  if(resource.value==='users'&&record.value?.id===savedUser.id){controller?.abort();record.value={...record.value,...changes} as User;loading.value=false;error.value='';refreshError.value='';}
  if(auth.user?.id===savedUser.id)auth.setUser({...auth.user,...changes});
}
function participantLabel(count:number){
  const form=count%100>=11&&count%100<=14?2:count%10===1?0:count%10>=2&&count%10<=4?1:2;
  return `${count} ${['участник','участника','участников'][form]}`;
}
async function act(action:()=>Promise<unknown>){if(busy.value)return;busy.value=true;actionError.value='';try{await action();await load();}catch(e){actionError.value=e instanceof Error?e.message:'Не удалось выполнить действие';}finally{busy.value=false;}}
function changeParticipation(joining: boolean) {
  const kind = resource.value, path = `/${kind}/${id.value}/join`;
  const eventId = record.value?.id;
  void act(async () => {
    if (joining && kind === 'events') {
      const { data } = await api.post<ApiResponse<Entity>>(path, {});
      if (resource.value === kind && record.value?.id === eventId) {
        record.value = new EntityBuilder().from(data).build();
        showItems.value = true;
      }
    } else if (joining) await api.post(path, {});
    else await api.delete(path);
    if (kind === 'teams') await auth.restore(true);
  });
}
function rosterSaved(removedUserId?: string) {
  void load();
  if (removedUserId && removedUserId === auth.user?.id) void auth.restore(true);
}
function join(){if(resource.value==='challenges'){showJoin.value=true;return;}changeParticipation(true);}
function leave(){changeParticipation(false);}
function toggleRead(){void act(()=>api.put(`/books/${id.value}/read`,{read:!hasRead.value}));}
watch([resource,id],([kind,next],[previous])=>{if(kind===previous&&record.value?.publicId&&String(record.value.publicId)===next)return;
  for (const modal of [showEditor,showItems,showJoin,showResult,showReaders]) modal.value=false;
  record.value=null;actionError.value='';refreshError.value='';void load();},{immediate:true});
useRealtime(message=>{if(message.type==='invalidate'&&([resource.value,'*'].includes(message.resource)||(['users','challenges'].includes(resource.value)&&message.resource==='teams')||(resource.value==='teams' && message.resource==='challenges')))void load();});
watch([() => route.path, record, error], ([path, item, problem]) => {
  detailBreadcrumb.value = { path, title: item ? ('name' in item ? item.name : item.title) : problem ? 'Страница недоступна' : 'Загрузка…' };
}, { immediate: true });
onBeforeUnmount(() => { controller?.abort(); detailBreadcrumb.value = null; });
</script>

<template lang="pug">
.detail-page
  .detail-refresh-error(v-if="refreshError" role="status")
    span Не удалось обновить страницу: {{ refreshError }}
    NButton(size="small" @click="load") Повторить
  template(v-if="loading")
    NSkeleton(height="3rem" style="border-radius:1rem;margin-bottom:1rem")
    NSkeleton(text :repeat="5")
  .detail-error(v-else-if="error" role="alert")
    h2 Не удалось загрузить страницу
    p {{ error }}
    NButton(@click="load") Повторить
  template(v-else-if="record && resource === 'users'")
    .detail-columns
      .detail-main
        DetailCard
          template(#title)
            .profile-title
              ProfileIdentityEditor(:key="`identity-${user.id}`" :user="user" :editable="isOwn" @saved="profileIdentitySaved")
              .profile-eyebrow
                span.admin-mark(v-if="user.role === 'admin'") АДМИН
                RouterLink.profile-id(v-if="user.publicId" :to="userPath(user)" data-tooltip="Ссылка на профиль") ID {{ user.publicId }}
          ProfileLocationEditor(:key="`location-${user.id}`" :user="user" :editable="isOwn" @saved="profileSaved($event, 'location')")
          ProfileTextEditor(:key="`bio-${user.id}`" :user="user" field="bio" :editable="isOwn" @saved="profileSaved($event, 'bio')")
        ProfileTagsSection(:key="`tags-${user.id}`" :user="user" :editable="isOwn" @saved="profileSaved($event, 'tags')")
        ProfileEntriesSection.detail-panel(v-if="isOwn || user.facts.length" :key="`facts-${user.id}`" :user="user" field="facts" title="Несколько фактов" icon="check" :editable="isOwn" @saved="profileSaved($event, 'facts')")
        ProfileEntriesSection.detail-panel(v-if="isOwn || user.achievements.length" :key="`achievements-${user.id}`" :user="user" field="achievements" title="Достижения" icon="trophy" :editable="isOwn" @saved="profileSaved($event, 'achievements')")
        section.detail-panel.profile-teams
          h2
            Icon(name="shield-halved")
            | {{ (user.activeTeams?.length || 0) > 1 ? 'Команды' : 'Команда' }}
          .profile-team-list(v-if="user.activeTeams?.length")
            article.profile-team-card(v-for="team in user.activeTeams" :key="team.id")
              .profile-team-heading
                RouterLink(:to="`/teams/${team.publicId ?? team.id}`") {{ team.title }}
                span {{ participantLabel(team.memberCount) }}
              p(v-if="team.description") {{ team.description }}
              p.profile-team-empty(v-else) У команды пока нет описания.
          p.profile-team-empty(v-else) {{ isOwn ? 'Вы пока не состоите в активной команде.' : 'Пока не состоит в активной команде.' }}
      aside.detail-side
        section.detail-panel
          h2 В движении
          .profile-numbers
            div
              strong {{ user.stats.events }}
              span мероприятий
            div
              strong {{ user.stats.challenges }}
              span челленджей
            div
              strong {{ user.stats.books }}
              span книг
        section.detail-panel.profile-import(v-if="isOwn")
          Icon(name="file-import")
          h3 Ваши данные — с вами
          p Сохраните профиль или перенесите информацию из JSON.
          RouterLink(to="/profile/import") Импорт и экспорт
  template(v-else-if="record")
    .action-error(v-if="actionError" role="alert") {{ actionError }}
    .detail-columns
      .detail-main
        DetailCard(:key="entity.id" :entity="entity" :status="entity.status === 'active' && ended ? 'completed' : entity.status")
          template(v-if="entity.likes" #leading)
            EntityLikeButton(:entity="entity" :summary="entity.likes")
          .details-heading
            span.profile-eyebrow {{ [resourceMeta[resource].singular, categoryLabels[entity.category] || entity.category].filter(Boolean).join(' · ') }}
            span.challenge-participation(v-if="['teams', 'events'].includes(resource) && participant")
              Icon(name="circle-check")
              | Вы участвуете
            NButton(v-else-if="resource === 'teams' && !ended" type="primary" size="small" :loading="busy" @click="join") Вступить в команду
            span.challenge-participation(v-else-if="resource === 'challenges' && participant" tabindex="0" :data-tooltip="participant.team ? 'Вы участвуете за ' + participant.team.title : 'Вы участвуете лично'")
              Icon(name="circle-check")
              | Участвую
          p.entity-motto(v-if="entity.motto") «{{ entity.motto }}»
          p.prose(v-if="entity.description") {{ entity.description }}
          p.prose(v-if="entity.content") {{ entity.content }}
          .profile-tags(v-if="entity.tags.length")
            span(v-for="tag in entity.tags" :key="tag.id") {{ tag.name }}
          TeamChallengeProgress(v-if="resource === 'teams'" :key="entity.id" :active="entity.activeTeamChallenges" :finished="entity.teamChallenges")
          template(v-if="canEdit" #actions)
            NButton(secondary size="small" @click="showEditor = true")
              template(#icon)
                Icon(name="pen")
              | Редактировать
            FeedbackStatusActions(v-if="resource === 'feedback' && auth.isAdmin" :entity="entity" @status-changed="feedbackStatusChanged")
        template(v-if="resource === 'challenges'")
          section.detail-panel
            .section-heading
              h2 Общий результат
              span {{ entity.goal?.unit || 'ед.' }}
            .challenge-progress
              strong {{ standings.score.toLocaleString('ru-RU') }}
              span(v-if="entity.goal") / {{ standings.target.toLocaleString('ru-RU') }} {{ entity.goal.unit }}
            .progress-track
              span(:style="{width: `${standings.target ? Math.min(100, standings.score / standings.target * 100) : 0}%`}")
            p.progress-caption(v-if="entity.goal") {{ entity.goal.target.toLocaleString('ru-RU') }} {{ entity.goal.unit }} на человека × {{ participantLabel(standings.members) }}
          ChallengeStandings(:standings="standings" :challenge-id="entity.id" :unit="entity.goal?.unit || 'ед.'" :personal-goal="entity.goal?.target ?? 0" :current-user="auth.user?.id")
          ChallengeResultsSection(:key="`results-${entity.id}`" :entity="entity")
        TeamRoster(v-if="resource === 'teams'" :key="entity.id" :team="entity" :manage="auth.can('members.manage')" @saved="rosterSaved")
        section.detail-panel(v-if="resource === 'events'")
          .section-heading
            h2 Участники
            span {{ entity.participants.length }}{{ entity.capacity ? ` / ${entity.capacity}` : '' }}
          .participant-list
            .participant-row(v-for="part in entity.participants" :key="part.user.id")
              .participant-person
                UserAvatar(:user="part.user")
                small(v-if="part.user.location.city") {{ part.user.location.city }}
              p.attendance-comment(v-if="part.comment") {{ part.comment }}
              .participant-items(v-if="part.items?.length")
                span(v-for="item in part.items" :key="item.id") {{ item.name }} × {{ item.quantity || 1 }}
            p.empty-inline(v-if="!entity.participants.length") Здесь пока никого. Присоединяйтесь первым.
      aside.detail-side
        section.detail-panel.action-panel(v-if="['events','challenges'].includes(resource)")
          .info-row(v-if="entity.schedule")
            Icon(name="calendar")
            div
              small {{ resource === 'challenges' ? 'Период проведения' : 'Когда встречаемся' }}
              strong {{ dateLabel(entity.schedule.start) }}{{ resource === 'challenges' ? ` — ${dateLabel(entity.schedule.end)}` : '' }}
              span(v-if="resource === 'events'") {{ new Date(entity.schedule.start).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}) }} · ваше время
          .info-row(v-if="entity.location")
            Icon(name="location-dot")
            div
              small Где
              strong {{ [entity.location.city, entity.location.country].filter(value => value.trim()).join(', ') || 'Место не указано' }}
          .info-row(v-if="entity.goal")
            Icon(name="bullseye")
            div
              small {{ resource === 'challenges' ? 'Цель на одного участника' : 'Цель' }}
              strong {{ entity.goal.target.toLocaleString('ru-RU') }} {{ entity.goal.unit }}
          .info-row
            Icon(name="users")
            div
              small {{ resource === 'events' ? 'Запись на мероприятие' : 'Участники' }}
              strong {{ participantLabel(entity.participants.length) }}
              span(v-if="resource === 'events'") {{ entity.capacity == null ? 'Без ограничения мест' : 'Всего мест: ' + entity.capacity }}
          .info-row(v-if="resource === 'events'")
            Icon(name="user")
            div
              small Организатор
              UserAvatar(v-if="entity.organizerUser" :user="entity.organizerUser")
              strong(v-else) {{ entity.organizer && 'name' in entity.organizer ? entity.organizer.name : 'Не указан' }}
          NButton(v-if="!participant && !ended" type="primary" block :disabled="eventFull" :loading="busy" @click="join") {{ eventFull ? 'Свободных мест нет' : resource === 'challenges' ? 'Принять вызов' : 'Я пойду' }}
          NButton(v-if="participant && resource === 'events' && !ended" type="primary" block @click="showItems = true")
            template(#icon)
              Icon(name="backpack")
            | Вещи и комментарий
          NButton(v-if="participant && resource === 'challenges' && !ended && started" type="primary" block @click="showResult = true")
            template(#icon)
              Icon(name="plus")
            | Записать результат
          p.join-hint(v-if="participant && resource === 'challenges' && !ended && !started") Запись результатов откроется {{ dateLabel(entity.schedule?.start) }}.
          p.closed-notice(v-if="ended") Участие завершено
          NButton.leave-button(v-if="participant && resource !== 'teams' && !ended" :type="resource === 'challenges' ? 'error' : 'default'" :secondary="resource === 'challenges'" :quaternary="resource !== 'challenges'" block :loading="busy" @click="leave")
            template(v-if="resource === 'challenges'" #icon)
              Icon(name="right-from-bracket")
            | Отменить участие
        section.detail-panel.team-challenges(v-if="resource === 'teams'")
          h2 Пройденные челленджи
          article(v-for="challenge in entity.teamChallenges" :key="challenge.id")
            RouterLink(:to="`/challenges/${challenge.publicId ?? challenge.id}`") {{ challenge.title }}
            .finished-metrics
              ChallengeMetric(icon="trophy" label="Результат команды" :value="challenge.score" :unit="challenge.unit")
              ChallengeMetric(v-if="challenge.target != null" icon="bullseye" label="Цель команды" :value="challenge.target" :unit="challenge.unit")
          p.empty-inline(v-if="!entity.teamChallenges?.length") У команды пока нет завершённых челленджей.
        section.detail-panel.personal-score(v-if="resource === 'challenges' && participant")
          span МОЙ РЕЗУЛЬТАТ
          strong {{ ownTotal.toLocaleString('ru-RU') }}
          small {{ entity.goal?.unit || 'единиц' }} за всё время
          .own-result(v-for="result in (entity.results || []).filter(r => r.user.id === auth.user?.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7)" :key="result.date")
            span {{ dateLabel(result.date) }}
            b {{ result.value }}
        section.detail-panel(v-if="resource === 'books'")
          h2 Книга объединяет
          button.readers-button(type="button" @click="showReaders = true")
            Icon(name="book-open")
            strong {{ entity.readers?.length || 0 }}
            span уже прочитали
          NButton(type="primary" block :loading="busy" @click="toggleRead")
            template(#icon)
              Icon(:name="hasRead ? 'check' : 'plus'")
            | {{ hasRead ? 'Прочитано · убрать отметку' : 'Я прочитал эту книгу' }}
        section.detail-panel.detail-note
          Icon(name="shield-halved")
          p Только для участников KLAN. Берегите доверие и личную информацию друг друга.
          RouterLink(to="/rules") Правила сообщества
    EntityEditorModal(v-model:show="showEditor" :resource="resource" :entity="entity" @saved="load")
    EventItemsModal(v-if="resource === 'events'" v-model:show="showItems" :entity="entity" @saved="load")
    ChallengeJoinModal(v-if="resource === 'challenges'" v-model:show="showJoin" :entity="entity" @saved="load")
    ChallengeResultModal(v-if="resource === 'challenges'" v-model:show="showResult" :entity="entity" @saved="load")
    ReadersModal(v-if="resource === 'books'" v-model:show="showReaders" :readers="entity.readers || []")
</template>

<style scoped>
.finished-metrics{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .85rem}

.team-challenges article{display:grid;gap:.25rem;font-size:.8rem;color:var(--muted);padding:.6rem 0}.team-challenges article+article{border-top:1px solid var(--border)}.team-challenges article a{font-weight:650;color:#edb38a;text-decoration:none}.team-challenges article a:hover{text-decoration:underline}
.details-heading{display:flex;gap:.6rem;justify-content:space-between;align-items:flex-start;margin-bottom:1rem}

.challenge-participation{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;border-radius:1rem;background:#233328;color:#b4d8b8;font-size:.69rem;white-space:nowrap}

.profile-team-list{display:flex;flex-direction:column;gap:1rem}.profile-team-card+.profile-team-card{border-top:1px solid #ffffff0a;padding-top:1rem}.profile-team-heading{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem 1rem;flex-wrap:wrap}.profile-team-heading>a{color:#e7b78f;text-decoration:none;font-weight:600;font-size:.95rem;overflow-wrap:anywhere}.profile-team-heading>a:hover{color:#ffd0ab;text-decoration:underline}.profile-team-heading>a:focus-visible{outline:2px solid var(--accent);outline-offset:.2rem;border-radius:.2rem}.profile-team-heading>span{font-size:.72rem;color:#aa998b;white-space:nowrap}.profile-team-card>p{font-size:.82rem;color:#b4aca6;line-height:1.8;margin:.6rem 0 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere;white-space:pre-line}.profile-teams .profile-team-empty{color:#93877e;font-size:.8rem;line-height:1.7;margin:0}.profile-team-card>.profile-team-empty{margin-top:.5rem}
.detail-refresh-error{display:flex;justify-content:space-between;align-items:center;gap:.7rem;flex-wrap:wrap;border:1px solid #755d33;background:#2b251b;border-radius:.6rem;padding:.8rem;margin-bottom:1rem;color:#dcc391;font-size:.78rem}.detail-refresh-error>span{min-width:0;overflow-wrap:anywhere}
.profile-title{min-width:0;width:100%}.profile-eyebrow{flex-wrap:wrap}.profile-id{font-variant-numeric:tabular-nums;color:#9f948c;white-space:nowrap}
.detail-page{max-width:78rem;margin:0 auto}.detail-error,.action-error{padding:1.4rem;border:1px solid #753c33;background:#291a17;border-radius:.8rem;color:#e2a89b}.action-error{margin-bottom:1rem;font-size:.85rem}.profile-title h1{font-size:clamp(1.7rem,3.5vw,2.4rem);line-height:1.15;margin:.45rem 0 .6rem;letter-spacing:-.05em;color:#f2efeb}.profile-title p{display:flex;align-items:center;gap:.5rem;margin:0;color:#9f948c;font-size:.8rem}.profile-eyebrow{display:flex;align-items:center;gap:.5rem;font-size:.57rem;letter-spacing:.14em;color:#ae8d72}.admin-mark{border:1px solid #705035;border-radius:.2rem;padding:.15rem .3rem;color:#eaa16a}.detail-columns{display:grid;grid-template-columns:minmax(0,1fr) 19rem;gap:1.2rem;align-items:start}.detail-main,.detail-side{display:flex;flex-direction:column;gap:1.2rem;min-width:0}.detail-panel{border:1px solid #302d29;border-radius:.9rem;padding:1.5rem;background:#1a1919}.detail-panel h2{font-size:1rem;font-weight:650;margin:0 0 1rem;letter-spacing:-.02em;display:flex;align-items:center;gap:.6rem}.detail-panel h2>:deep(svg){font-size:.9rem;color:#d88d52}.prose{white-space:pre-line;color:#b4aca6;line-height:1.9;font-size:.86rem;margin:0 0 1rem;overflow-wrap:anywhere}.prose:last-child{margin-bottom:0}.profile-tags,.interest-list{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.4rem}.profile-tags>*{font-size:.7rem;background:#36271d;border:1px solid #5c3c25;padding:.4rem .7rem;color:#e8a571;border-radius:.4rem;text-decoration:none}.interest-list{margin-top:0}.interest-list>span{font-size:.78rem;border:1px solid #3e3831;padding:.55rem .75rem;border-radius:.5rem;color:#b8aaa0;background:#24211e}.fact-list{padding:0;margin:0;list-style:none;display:flex;flex-direction:column;gap:.85rem}.fact-list>li{display:flex;align-items:baseline;gap:.7rem;font-size:.84rem;color:#bcb1a8;line-height:1.6}.fact-list>li>:deep(svg){color:#dd9259;font-size:.75rem;flex-shrink:0}.profile-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-top:1.3rem}.profile-numbers>div{display:flex;flex-direction:column;gap:.25rem}.profile-numbers strong{font-size:1.55rem;color:#f5dbc7;font-weight:600}.profile-numbers span{font-size:.59rem;color:#96877b}.team-history{display:flex;align-items:center;gap:.6rem;text-decoration:none;color:#c4b7ac;font-size:.75rem;padding:.6rem 0}.team-history>span{flex:1}.team-history>:deep(svg){color:#cf8b57}.profile-import>:deep(svg){color:#e49960}.profile-import h3{font-size:.9rem;margin:.8rem 0 .5rem}.profile-import p,.detail-note p{font-size:.73rem;color:#958b83;line-height:1.7}.profile-import>a,.detail-note>a{font-size:.72rem;color:#d08b58;text-decoration:none}.entity-motto{margin:.5rem 0 0;color:#bc8c66;font-size:.9rem;font-style:italic}.info-row{display:flex;gap:.85rem;margin-bottom:1.4rem}.info-row>:deep(svg){color:#b98962;font-size:.95rem;margin-top:.2rem}.info-row>div{min-width:0;overflow-wrap:anywhere;display:flex;flex-direction:column;gap:.25rem}.info-row small{font-size:.65rem;color:#8b7e74}.info-row strong{font-size:.8rem;font-weight:500;color:#d4c6ba;line-height:1.5}.info-row span{font-size:.7rem;color:#9b8a7b}.participation-notice{display:flex;gap:.5rem;align-items:center;padding:.7rem;border:1px solid #3e5944;background:#233328;color:#a8c6a9;border-radius:.5rem;font-size:.72rem;line-height:1.5;margin-bottom:1rem}.leave-button{margin-top:.4rem;font-size:.7rem}.join-hint,.closed-notice{font-size:.7rem;color:#94877b;line-height:1.7;margin:1rem 0 0}.closed-notice{padding:.7rem;text-align:center;border:1px solid #443b32;border-radius:.4rem}.participant-list{display:flex;flex-direction:column;gap:.8rem}.participant-row{border-top:1px solid #ffffff09;padding-top:.8rem}.participant-person{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:#d1c7be}.participant-person strong{font-size:.8rem;font-weight:500;display:block}.participant-person small{font-size:.65rem;color:#8f8277;display:block;margin-top:.2rem}.participant-items{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0 0 2.7rem}.participant-items>span{font-size:.65rem;color:#b8a18d;background:#29231f;padding:.25rem .45rem;border-radius:.3rem}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem}.section-heading>h2{margin:0}.section-heading>span{color:#98897d;font-size:.7rem}.challenge-progress{display:flex;align-items:baseline;gap:.5rem;margin-top:.6rem}.challenge-progress strong{font-size:2.4rem;letter-spacing:-.04em;color:#efb183;font-weight:600}.challenge-progress>span{color:#9a8879;font-size:.85rem}.progress-track{height:.45rem;border-radius:1rem;background:#392c22;overflow:hidden;margin-top:.9rem}.progress-track>span{display:block;height:100%;background:linear-gradient(90deg,#d77832,#ffb071);border-radius:1rem;transition:width .4s}.progress-caption{font-size:.7rem;color:#978578;margin-bottom:0}.personal-score{background:linear-gradient(140deg,#34251b,#211c18);border-color:#614026}.personal-score>span{display:block;font-size:.6rem;letter-spacing:.1em;color:#c88f64}.personal-score>strong{display:block;font-size:3rem;line-height:1.5;color:#ffb67e;letter-spacing:-.06em;font-weight:500}.personal-score>small{font-size:.7rem;color:#ba9171}.own-result{display:flex;justify-content:space-between;border-top:1px solid #ffffff0b;margin-top:.7rem;padding-top:.5rem;font-size:.7rem;color:#bda18b}.own-result>b{color:#e0b18a}.empty-inline{color:#8f8177;font-size:.8rem}.readers-button{display:flex;align-items:center;gap:.65rem;font:inherit;width:100%;color:#d3bcaa;background:#29211c;border:1px solid #44342a;border-radius:.5rem;padding:.8rem;margin-bottom:1rem;cursor:pointer}.readers-button:hover{border-color:#98714f}.readers-button strong{font-size:1.35rem;color:#f5b888}.readers-button span{font-size:.72rem}.detail-note>:deep(svg){color:#8b715b}.detail-note p{margin:.7rem 0}.detail-panel .n-button{min-height:2.75rem}@media(max-width:58rem){.detail-columns{grid-template-columns:minmax(0,1fr) 16rem}.detail-panel{padding:1.15rem}}@media(max-width:45rem){.detail-columns{display:flex;flex-direction:column;align-items:stretch}.detail-main{display:contents}.detail-main>:first-child{order:-2}.detail-side{order:-1}.profile-title h1{font-size:1.6rem}.detail-note{display:none}.info-row{margin-bottom:1rem}.detail-side{gap:.8rem}.personal-score>strong{font-size:2.5rem}.detail-main,.detail-columns{gap:.8rem}}
.attendance-comment{margin:.35rem 0;color:var(--text);font-size:.85rem;white-space:pre-wrap;overflow-wrap:anywhere}
</style>

