<script setup lang="ts">
import { computed } from 'vue';
import { userPath } from '@shared/user-links';
import type { Entity, Resource, User } from '@shared/contracts';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import Icon from '@/components/ui/Icon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { categoryLabels, dateLabel, resourceMeta } from './resourceMeta';
import { rankMemberTags } from '@/domain/tagPopularity';
const props = defineProps<{ item: User | Entity; resource: Resource; tagCounts?: ReadonlyMap<string, number> }>();
const user = computed(() => props.item as User);
const entity = computed(() => props.item as Entity);
const title = computed(() => props.resource === 'users' ? user.value.name : entity.value.title);
const coverClass = computed(() => `${props.resource}-${(props.item.id.charCodeAt(props.item.id.length - 1) || 0) % 3}`);
const memberTags = computed(() => rankMemberTags(user.value.tags, props.tagCounts ?? new Map()));
const remainingTags = computed(() => memberTags.value.slice(3));
</script>

<template lang="pug">
RouterLink.resource-card(:to="resource === 'users' ? userPath(user) : `/${resource}/${item.publicId ?? item.id}`" :class="{ 'resource-card--person': resource === 'users', 'resource-card--book': resource === 'books' }")
  template(v-if="resource === 'users'")
    .person-heading
      h3
        UserAvatar(:user="user" size="md" embedded)
      span.person-role(v-if="user.role === 'admin'") Администратор
    p.card-location
      Icon(name="location-dot")
      | {{ [user.location.city, user.location.country].filter(value => value.trim()).join(', ') || 'Город не указан' }}
    p.card-description(v-if="user.bio.trim()") {{ user.bio }}
    .card-tags
      span(v-for="tag in memberTags.slice(0, 3)" :key="tag.id") {{ tag.name }}
      span.more-tags(v-if="remainingTags.length" :title="remainingTags.map(tag => tag.name).join(', ')" :aria-label="`Ещё ${remainingTags.length} тегов: ${remainingTags.map(tag => tag.name).join(', ')}`") +{{ remainingTags.length }}
    .person-bottom
      span {{ user.stats.events }} мероприятий
      span.member-tag-count Тегов: {{ memberTags.length }}
      Icon(name="arrow-up-right-from-square")
  template(v-else)
    .card-illustration(v-if="['events', 'challenges', 'teams', 'books'].includes(resource)" :class="coverClass")
      span.illustration-grid
      Icon(:name="resourceMeta[resource].icon")
      span.card-category {{ categoryLabels[entity.category] || entity.category || resourceMeta[resource].singular }}
      StatusBadge(:status="entity.status")
    .card-body
      .card-topline(v-if="!['events', 'challenges', 'teams', 'books'].includes(resource)")
        span {{ categoryLabels[entity.category] || entity.category || dateLabel(entity.createdAt) }}
        StatusBadge(:status="entity.status")
      .card-date(v-if="entity.schedule")
        Icon(name="calendar")
        span {{ dateLabel(entity.schedule.start) }}{{ resource === 'challenges' ? ` — ${dateLabel(entity.schedule.end)}` : '' }}
      h3 {{ title }}
      p.card-description {{ entity.description }}
      .card-tags(v-if="entity.tags.length")
        span(v-for="tag in entity.tags.slice(0, 3)" :key="tag.id") {{ tag.name }}
      .card-footer
        span(v-if="entity.location")
          Icon(name="location-dot")
          | {{ entity.location.city }}
        span(v-else-if="resource === 'books'")
          Icon(name="book-open")
          | Прочитали {{ entity.readerCount ?? entity.readers?.length ?? 0 }}
        span(v-else-if="['teams', 'challenges'].includes(resource)")
          Icon(name="users")
          | {{ entity.participantCount ?? entity.participants.length }} участников
        span(v-else) {{ dateLabel(entity.createdAt) }}
        Icon(name="arrow-right")
</template>

<style scoped>
.person-heading{gap:.6rem;flex-wrap:wrap}.person-heading h3{margin:0;min-width:0}
.resource-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid var(--border,#2b2b2c);border-radius:1rem;background:var(--surface,#19191b);color:inherit;text-decoration:none;transition:transform .2s,border-color .2s,box-shadow .2s}.resource-card:hover{transform:translateY(-.2rem);border-color:#80613f;box-shadow:0 .75rem 2rem #0003}.resource-card--person{padding:1.4rem}.person-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.15rem}.person-role{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#ff964d;padding:.25rem .45rem;border:1px solid #664328;border-radius:.3rem}.resource-card h3{font-size:1.1rem;line-height:1.4;letter-spacing:-.02em;margin:0 0 .55rem;font-weight:700}.card-location,.card-date{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:#9c9b9c;margin:0 0 1rem}.card-description{font-size:.84rem;color:#9c9b9c;line-height:1.65;margin:0 0 1rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card-tags{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:auto;margin-bottom:1.2rem}.card-tags span{padding:.22rem .5rem;border-radius:.3rem;background:#282626;color:#c2b9b4;font-size:.66rem}.person-bottom,.card-footer{display:flex;justify-content:space-between;align-items:center;gap:.5rem;border-top:1px solid #ffffff0c;padding-top:.9rem;color:#aaa4a1;font-size:.72rem}.person-bottom>:last-child,.card-footer>:last-child{color:#f28538}.card-illustration{height:9.2rem;position:relative;background:linear-gradient(135deg,#313c2c,#151b17);overflow:hidden;padding:1rem;display:flex;align-items:flex-end;justify-content:space-between}.card-illustration>:deep(svg){position:absolute;font-size:4.5rem;right:1.8rem;top:1.7rem;color:#c2cdbb33;transform:rotate(-12deg)}.illustration-grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px);background-size:1.5rem 1.5rem;mask-image:linear-gradient(transparent,#000)}.card-category{z-index:1;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;background:#0006;border:1px solid #ffffff18;padding:.3rem .5rem;border-radius:.3rem;color:#e1e2dc}.card-illustration :deep(.status-badge){z-index:1}.events-1,.teams-2{background:linear-gradient(145deg,#4b3524,#211b19)}.events-2,.challenges-1{background:linear-gradient(145deg,#29333e,#141a21)}.challenges-0,.teams-0{background:linear-gradient(145deg,#4a2d20,#221914)}.challenges-2,.teams-1{background:linear-gradient(145deg,#363047,#1b1821)}.books-0,.books-1,.books-2{height:10rem;background:linear-gradient(145deg,#39332d,#171717)}.books-1{background:linear-gradient(145deg,#2b3940,#171a1b)}.books-2{background:linear-gradient(145deg,#3c2828,#191616)}.card-body{padding:1.2rem;display:flex;flex-direction:column;flex:1}.card-footer{margin-top:auto}.card-footer>span{display:flex;align-items:center;gap:.4rem}.card-topline{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:1rem;font-size:.67rem;color:#b5aaa2}.card-date{font-size:.67rem;margin-bottom:.6rem;color:#cf9a70}
</style>
