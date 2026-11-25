<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { subscribeRealtime } from '@/services/realtime'
import Icon from '@/components/ui/Icon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import HeaderOnline from '@/components/features/HeaderOnline.vue'
import { detailBreadcrumb } from '@/composables/useDetailBreadcrumb'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
onScopeDispose(subscribeRealtime(async event => {
  if (event.type !== 'invalidate' || event.resource !== 'access-settings') return
  await auth.restore(true)
  if (!auth.user) await router.replace({name:'login'})
  else if (route.meta.admin && !auth.isAdmin) await router.replace({name:'dashboard'})
}))
const menuOpen = ref(false)
const loggingOut = ref(false)
const logoutError = ref('')
const accountRole = computed(() => auth.isAdmin ? 'Администратор' : auth.user?.access?.level === 'moderator' ? 'Модератор' : 'Участник сообщества')
const navigation = [
  { title: 'ТЕРРИТОРИЯ', links: [
    { to: '/', title: 'Обзор', icon: 'compass' },
    { to: '/users', title: 'Участники', icon: 'users' },
    { to: '/teams', title: 'Команды', icon: 'shield-halved' },
  ] },
  { title: 'ДЕЙСТВУЙ', links: [
    { to: '/events', title: 'Встречи', icon: 'calendar-days' },
    { to: '/challenges', title: 'Челленджи', icon: 'fire' },
  ] },
  { title: 'СООБЩЕСТВО', links: [
    { to: '/news', title: 'Новости', icon: 'newspaper' },
    { to: '/books', title: 'Библиотека', icon: 'book-open' },
    { to: '/rules', title: 'Кодекс сообщества', icon: 'scroll' },
    { to: '/stats', title: 'Статистика', icon: 'chart-simple' },
    { to: '/feedback', title: 'Обратная связь', icon: 'comment' },
  ] },
]
const currentTitle = computed(() => route.meta.title as string || navigation.flatMap(g => g.links).find(l => l.to !== '/' && route.path.startsWith(l.to))?.title || 'Обзор')
const sectionPath = computed(() => '/' + route.path.split('/')[1])
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  logoutError.value = ''
  try { await auth.logout(); await router.push('/login') }
  catch { logoutError.value = 'Не удалось выйти. Повторите попытку.' }
  finally { loggingOut.value = false }
}
</script>

<template lang="pug">
.app-shell
  button.mobile-backdrop(v-if="menuOpen" aria-label="Закрыть меню" @click="menuOpen = false")
  aside.sidebar(:class="{ 'is-open': menuOpen }")
    RouterLink.brand(to="/" @click="menuOpen = false" aria-label="Клан — главная")
      img.brand-mark(src="@/assets/klan-wordmark.jpg" width="144" height="36" alt="")
    .sidebar-inner
      nav.main-nav(aria-label="Основная навигация")
        .nav-group(v-for="group in navigation" :key="group.title")
          p.nav-caption {{ group.title }}
          RouterLink.nav-link(v-for="link in group.links" :key="link.to" :to="link.to" :class="{ active: link.to === '/' ? route.path === '/' : route.path.startsWith(link.to) }" @click="menuOpen = false")
            Icon(:name="link.icon")
            span {{ link.title }}
            span.nav-dot(v-if="link.to === '/challenges'")
        RouterLink.nav-link.admin-link(v-if="auth.can('content.manage')" to="/admin" @click="menuOpen = false")
          Icon(name="sliders")
          span Управление
        RouterLink.nav-link(v-if="auth.can('catalog.manage')" to="/admin/catalogs" @click="menuOpen = false")
          Icon(name="tags")
          span Справочники
        RouterLink.nav-link(v-if="auth.can('analytics.read')" to="/admin/analytics" @click="menuOpen = false")
          Icon(name="chart-simple")
          span Аналитика
      .sidebar-manifest
        Icon(name="mountain-sun")
        p Свои люди.
          br
          | Настоящие дела.
        span Закрытое сообщество
  .workspace
    header.topbar
      .topbar-start
        button.icon-button.mobile-menu(aria-label="Открыть меню" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen")
          Icon(name="bars")
        nav.breadcrumbs(aria-label="Хлебные крошки")
          RouterLink(to="/") Главная
          Icon(name="chevron-right")
          template(v-if="route.path.startsWith('/admin/')")
            RouterLink(to="/admin") Управление
            Icon(name="chevron-right")
          RouterLink(v-if="route.params.id" :to="sectionPath") {{ currentTitle }}
          span(v-else) {{ currentTitle }}
          template(v-if="route.params.id")
            Icon(name="chevron-right")
            span(aria-current="page") {{ detailBreadcrumb?.path === route.path ? detailBreadcrumb.title : 'Загрузка…' }}
      .topbar-actions
        HeaderOnline(v-if="auth.user")
        span.private-badge
          Icon(name="lock")
          span Закрытое сообщество
        RouterLink.icon-button.header-rules(to="/rules" data-tooltip="Правила сообщества" aria-label="Правила сообщества")
          Icon(name="circle-question")
        .topbar-account(v-if="auth.user" aria-label="Мой аккаунт")
          UserAvatar.account-profile(:user="auth.user" :aria-label="`Мой профиль: ${auth.user.name}`" @click="menuOpen = false")
            small.account-role {{ accountRole }}
          button.icon-button.account-logout(:disabled="loggingOut" :aria-busy="loggingOut" :data-tooltip="loggingOut ? 'Выходим…' : 'Выйти'" :aria-label="loggingOut ? 'Выходим из аккаунта' : 'Выйти из аккаунта'" @click="logout")
            Icon(name="right-from-bracket")
    p.account-error(v-if="logoutError" role="alert") {{ logoutError }}
    main.main-content
      RouterView(v-slot="{ Component }")
        ErrorBoundary(:key="route.name" :reset-on="route.path")
          component(:is="Component")
    footer.app-footer
      span KLAN / СИЛА В ЛЮДЯХ
      RouterLink(to="/feedback") Сделаем сообщество лучше
</template>

<style scoped>
.account-profile{font-size:.78rem}.account-role{color:var(--muted);font-size:.66rem}
.topbar{height:auto;min-height:4.4rem;padding-block:.6rem}.topbar-start{min-width:0;flex:1 1 auto}.breadcrumbs{min-width:0;overflow:hidden;white-space:nowrap}.breadcrumbs>a,.breadcrumbs>span{overflow:hidden;text-overflow:ellipsis;min-width:0}.breadcrumbs>svg{flex-shrink:0}.topbar-actions{min-width:0;flex:0 1 auto}.topbar-account{display:flex;align-items:center;gap:.25rem;min-width:0;border-left:1px solid var(--border);padding-left:.8rem}.account-profile{display:flex;align-items:center;gap:.7rem;min-width:0;border-radius:.35rem}.account-profile :deep(.avatar){flex-shrink:0}.account-caption{display:flex;flex-direction:column;gap:.2rem;min-width:0;max-width:20rem;text-align:right}.account-caption strong{font-size:.73rem;font-weight:700;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.account-caption span{font-size:.59rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.account-profile:hover .account-caption strong{color:var(--accent)}.account-logout{margin-left:.25rem}.account-error{margin:0;padding:.7rem 1rem;color:#f2a19b;background:#42231e;border-bottom:1px solid #694138;font-size:.8rem;line-height:1.5;overflow-wrap:anywhere}
@media(max-width:75rem){.private-badge{display:none}.account-caption{max-width:15rem}}
@media(max-width:40rem){.topbar{gap:.4rem;padding-inline:.75rem}.topbar-start{flex:0 0 auto}.breadcrumbs,.header-rules{display:none}.topbar-actions{flex:1 1 auto;justify-content:flex-end;gap:.35rem}.topbar-account{max-width:100%;padding-left:.5rem}.account-profile{gap:.45rem;min-width:0}.account-caption{max-width:calc(100vw - 11.5rem)}.account-caption strong{font-size:.68rem}.account-caption span{font-size:.55rem}.account-logout{margin-left:0}.account-error{padding-inline:.75rem}}
@media(max-width:40rem){
  .topbar{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center}
  .topbar-start{display:contents}.mobile-menu{grid-area:1/1}.topbar-actions{grid-area:1/2}
  .breadcrumbs{display:flex;grid-column:1/-1;grid-row:2;padding:.2rem .15rem;gap:.45rem}
  .breadcrumbs>a{flex-shrink:0}.breadcrumbs>[aria-current]{flex-shrink:1}
}
</style>
