import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { Resource } from '@shared/contracts';
import type { Capability } from '@shared/access';

const resources: [Resource, string][] = [
  ['users', 'Участники'], ['events', 'Встречи'], ['teams', 'Команды'], ['challenges', 'Челленджи'],
  ['news', 'Новости'], ['feedback', 'Обратная связь'], ['books', 'Библиотека'], ['rules', 'Кодекс сообщества'],
];
const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, saved) { return saved ?? (to.path === from.path ? undefined : { top: 0 }); },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true, title: 'Вход' } },
    {
      path: '/', component: () => import('@/layouts/AppShell.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Штаб' } },
        ...resources.flatMap(([resource, title]) => [
          { path: resource, name: resource, component: () => import('@/pages/ResourceListPage.vue'), meta: { title, resource } },
          { path: `${resource}/:id`, name: `${resource}-detail`, component: () => import('@/pages/ResourceDetailPage.vue'), meta: { title, resource, detail: true } },
        ]),
        { path: 'stats', name: 'stats', component: () => import('@/pages/StatsPage.vue'), meta: { title: 'Статистика' } },
        { path: 'admin', name: 'admin', component: () => import('@/pages/AdminPage.vue'), meta: { title: 'Управление', capability: 'content.manage' } },
        { path: 'admin/catalogs', name: 'catalogs', component: () => import('@/pages/CatalogAdminPage.vue'), meta: { title: 'Справочники', capability: 'catalog.manage' } },
        { path: 'admin/analytics', name: 'analytics', component: () => import('@/pages/AnalyticsPage.vue'), meta: { title: 'Аналитика', capability: 'analytics.read' } },
        { path: 'profile/import', name: 'import', component: () => import('@/pages/ImportPage.vue'), meta: { title: 'Мои данные' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
router.beforeEach(async to => {
  const auth = useAuthStore();
  await auth.restore();
  if (!to.meta.public && !auth.user) return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' };
  if (to.meta.capability && !auth.can(to.meta.capability as Capability)) return { name: 'dashboard' };
  if (to.name === 'login' && auth.user) return { name: 'dashboard' };
  return true;
});
router.afterEach(to => { document.title = `${String(to.meta.title ?? 'Сообщество')} · КЛАН`; });
window.addEventListener('klan:unauthorized', () => {
  if (!router.currentRoute.value.name || router.currentRoute.value.meta.public) return;
  void router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
});
export default router;
