<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSpin } from 'naive-ui';
import type { ApiResponse, User } from '@shared/contracts';
import { api, errorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import Icon from '@/components/ui/Icon.vue';

interface AuthConfig { demo: boolean; botUsername: string }
interface Challenge { id: string; botUrl: string; expiresAt: string }
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const config = ref<AuthConfig>();
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const challenge = ref<Challenge>();
const expired = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const controller = new AbortController();
const canTelegram = computed(() => Boolean(config.value?.botUsername));
const destination = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/login') ? redirect : '/';
});
async function loadConfig(): Promise<void> {
  loading.value = true; error.value = '';
  try { config.value = (await api.get<ApiResponse<AuthConfig>>('/auth/config', undefined, controller.signal)).data; }
  catch (cause) { if (!disposed) error.value = errorMessage(cause); }
  finally { if (!disposed) loading.value = false; }
}
async function enterDemo(): Promise<void> {
  busy.value = true; error.value = '';
  try { await auth.demoLogin(); if (!disposed) await router.replace(destination.value); }
  catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function poll(): Promise<void> {
  if (!challenge.value || disposed) return;
  if (Date.now() > new Date(challenge.value.expiresAt).getTime()) { expired.value = true; return; }
  try {
    const response = await api.get<ApiResponse<{ status: string; user?: User }>>(`/auth/telegram/status/${encodeURIComponent(challenge.value.id)}`, undefined, controller.signal);
    if (disposed) return;
    if (response.data.status === 'approved' && response.data.user) {
      auth.setUser(response.data.user);
      await router.replace(destination.value);
      return;
    }
    if (response.data.status === 'expired') { expired.value = true; return; }
    if (response.data.status === 'rejected' || response.data.status === 'denied') { error.value = 'Вход недоступен: бот не подтвердил участие в группе сообщества.'; return; }
    timer = setTimeout(() => { void poll(); }, 1800);
  } catch (cause) {
    if (disposed) return;
    error.value = errorMessage(cause);
  }
}
async function startTelegram(): Promise<void> {
  busy.value = true; error.value = ''; expired.value = false;
  if (timer) clearTimeout(timer);
  try {
    const response = await api.post<ApiResponse<Challenge>>('/auth/telegram/start');
    if (disposed) return;
    challenge.value = response.data;
    void poll();
  } catch (cause) { if (!disposed) error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
onMounted(() => { void loadConfig(); });
onUnmounted(() => { disposed = true; controller.abort(); if (timer) clearTimeout(timer); });
</script>

<template lang="pug">
.login-page
  header.login-topbar
    a.login-brand(href="/" aria-label="КЛАН — главная")
      svg.login-brand__mark(viewBox="0 0 38 38" aria-hidden="true")
        path(d="M3 31 18 5h7L10 31zm17-11 5-9 10 20H24z" fill="currentColor")
      span КЛАН
    span.login-topbar__label Закрытое сообщество
  main.login-main
    section.login-story
      p.login-kicker
        span.login-kicker__line
        | СИЛА В ОКРУЖЕНИИ
      h1 СВОИ.
        br
        span РЯДОМ.
      p.login-intro Люди, на которых можно положиться.
        br
        | Общие цели. Настоящие дела.
      .login-values
        .login-value
          Icon(name="mountain-sun")
          span Встречаемся вне сети
        .login-value
          Icon(name="flag")
          span Становимся сильнее вместе
        .login-value
          Icon(name="shield-halved")
          span Поддерживаем своих
      .login-terrain(aria-hidden="true")
        svg(viewBox="0 0 620 200" preserveAspectRatio="none")
          path(d="M0 170 80 120 130 142 228 42 272 91 325 15 390 99 440 65 520 130 620 85V200H0Z" fill="#262b21")
          path(d="m0 175 115-45 55 27 96-67 65 64 67-28 88 47 74-37 60 24v40H0Z" fill="#1c211a")
          path(d="m0 190 90-21 86 15 130-34 110 27 92-13 112 32v4H0Z" fill="#131713")
          path(d="m228 42-25 47 25-12 17 8zm97-27-26 51 26-16 21 13z" fill="#5f624c" opacity=".55")
        .login-terrain__caption 55°45′ С. Ш. · СВОИ ЕСТЬ ВЕЗДЕ
    section.login-panel(aria-labelledby="login-title")
      .login-panel__top
        span.login-panel__number 01 / ВХОД В СООБЩЕСТВО
        Icon(name="lock")
      .login-panel__content
        .login-emblem
          Icon(name="compass")
        h2#login-title Добро пожаловать
          br
          | в свой круг.
        p.login-panel__description Войдите через Telegram. Мы проверим участие в группе и откроем доступ к сообществу.
        .login-loading(v-if="loading")
          n-spin(size="small")
          span Подключаемся к сообществу…
        template(v-else)
          template(v-if="challenge && !expired")
            a.login-telegram(:href="challenge.botUrl" target="_blank" rel="noopener noreferrer")
              Icon(name="telegram")
              span Подтвердить в Telegram
              Icon(name="arrow-up-right-from-square")
            .login-wait
              n-spin(size="small")
              span Ожидаем подтверждение в боте…
          template(v-else)
            n-button.login-telegram-button(type="primary" block size="large" :loading="busy" :disabled="!canTelegram || busy" @click="startTelegram")
              template(#icon)
                Icon(name="telegram")
              | {{ expired ? 'Получить новую ссылку' : 'Войти через Telegram' }}
          p.login-expired(v-if="expired") Ссылка истекла. Создайте новую для безопасного входа.
          p.login-config-note(v-if="!canTelegram && !config?.demo && !error") Вход ещё не настроен. Администратору нужно подключить бота Telegram.
          .login-demo(v-if="config?.demo")
            .login-divider
              span ЛОКАЛЬНАЯ ДЕМОВЕРСИЯ
            n-button(block size="large" :loading="busy" :disabled="busy" @click="enterDemo")
              template(#icon)
                Icon(name="arrow-right")
              | Войти в локальный аккаунт
            p Вход без Telegram доступен только в локальном режиме.
        .login-error(v-if="error || auth.error" role="alert")
          Icon(name="circle-info")
          span {{ error || auth.error }}
          button(v-if="!config" type="button" @click="loadConfig") Повторить
        .login-private
          Icon(name="shield-halved")
          p Только участники сообщества.
            br
            | Ваш профиль виден только своим.
      footer.login-panel__footer
        span ЧЕСТНОСТЬ
        i
        span ВЗАИМОПОМОЩЬ
        i
        span ДЕЙСТВИЕ
  footer.login-footer
    span © {{ new Date().getFullYear() }} КЛАН
    span Не место. Окружение.
</template>

<style scoped>
.login-page { min-height: 100dvh; background: #101310; color: #eceee7; padding: 0 1.25rem; overflow: hidden; position: relative; }
.login-page::before { content: ''; pointer-events: none; position: absolute; inset: 0; background: radial-gradient(ellipse at 12% 55%, #4a44251c, transparent 48%), repeating-linear-gradient(0deg, transparent, transparent 4.98rem, #ffffff02 5rem), repeating-linear-gradient(90deg, transparent, transparent 4.98rem, #ffffff02 5rem); }
.login-topbar, .login-footer { position: relative; max-width: 75rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
.login-topbar { height: 6rem; border-bottom: 1px solid #ffffff0b; }
.login-brand { display: flex; align-items: center; gap: .7rem; color: #eceee7; text-decoration: none; font-size: 1.7rem; font-weight: 900; letter-spacing: .075em; }
.login-brand__mark { width: 2.5rem; height: 2.5rem; color: #ee8732; }
.login-topbar__label { font-size: .63rem; color: #7c8378; letter-spacing: .06em; text-transform: uppercase; }
.login-main { position: relative; max-width: 67rem; margin: 0 auto; padding: 2rem 0 3rem; display: grid; gap: 2rem; }
.login-story { position: relative; padding: 1rem 0 0; }
.login-kicker { display: flex; align-items: center; gap: .75rem; color: #b8a17a; letter-spacing: .18em; font-size: .6rem; font-weight: 800; }
.login-kicker__line { width: 1.75rem; height: 1px; background: #cb7a35; }
.login-story h1 { font-size: clamp(4rem, 8vw, 7rem); font-weight: 900; letter-spacing: -.07em; line-height: .95; margin: 1.8rem 0 1.3rem; }
.login-story h1 span { color: #f28a36; }
.login-intro { color: #a1a696; font-size: .96rem; line-height: 1.9; }
.login-values { display: none; gap: .85rem; margin: 2rem 0 0; }
.login-value { display: flex; align-items: center; gap: .75rem; color: #969c8e; font-size: .75rem; }
.login-value .ui-icon { color: #d38b48; width: 1.25rem; }
.login-terrain { display: none; position: relative; margin-top: .5rem; margin-left: -3rem; width: calc(100% + 5rem); height: 13rem; }
.login-terrain svg { width: 100%; height: 100%; }
.login-terrain__caption { position: absolute; bottom: .8rem; left: 3rem; color: #606a58; font-size: .47rem; letter-spacing: .15em; }
.login-panel { background: linear-gradient(140deg, #22271ff0, #191d17f0); border: 1px solid #ffffff13; border-radius: 1.15rem; overflow: hidden; box-shadow: 0 1.5rem 4rem #0000001a; align-self: center; }
.login-panel__top { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; border-bottom: 1px solid #ffffff0b; color: #79826e; }
.login-panel__number { font-size: .52rem; letter-spacing: .12em; font-weight: 700; }
.login-panel__top .ui-icon { font-size: .7rem; }
.login-panel__content { padding: 1.75rem 1.5rem; }
.login-emblem { width: 3rem; height: 3rem; display: grid; place-items: center; border: 1px solid #c3853a30; background: #bb6c1510; color: #d9954e; border-radius: .85rem; font-size: 1.3rem; margin-bottom: 1.3rem; }
.login-panel h2 { font-weight: 750; font-size: 1.85rem; letter-spacing: -.035em; line-height: 1.2; margin: 0; }
.login-panel__description { color: #929a88; font-size: .78rem; line-height: 1.8; margin: 1rem 0 1.7rem; }
.login-loading, .login-wait { display: flex; gap: .7rem; align-items: center; justify-content: center; padding: .75rem 0; color: #a9ae9e; font-size: .7rem; }
.login-telegram { min-height: 3rem; display: flex; align-items: center; justify-content: center; gap: .65rem; border-radius: .6rem; background: #ff7a00; text-decoration: none; color: #151b12; font-size: .85rem; font-weight: 800; }
.login-telegram-button { font-weight: 800; }
.login-config-note, .login-expired { color: #af9d78; font-size: .73rem; line-height: 1.7; }
.login-divider { display: flex; align-items: center; gap: .65rem; color: #6f7864; font-size: .45rem; letter-spacing: .13em; margin: 1.4rem 0 1rem; }
.login-divider::before, .login-divider::after { content: ''; flex: 1; height: 1px; background: #ffffff0c; }
.login-demo p { color: #727c68; text-align: center; font-size: .61rem; line-height: 1.7; margin: .8rem 0 0; }
.login-private { display: flex; gap: .7rem; justify-content: center; margin-top: 1.8rem; align-items: center; color: #77836b; }
.login-private p { margin: 0; font-size: .65rem; line-height: 1.65; }
.login-private .ui-icon { color: #7c8d68; }
.login-panel__footer { display: flex; align-items: center; justify-content: center; gap: .65rem; padding: 1.1rem .5rem; background: #14191288; border-top: 1px solid #ffffff08; color: #717b65; font-size: .43rem; font-weight: 800; letter-spacing: .08em; }
.login-panel__footer i { width: .15rem; height: .15rem; border-radius: 100%; background: #7b6643; }
.login-error { display: flex; gap: .6rem; align-items: center; padding: .8rem; border-radius: .5rem; background: #983b231d; color: #d59c7b; font-size: .72rem; margin-top: 1rem; }
.login-error button { background: transparent; color: inherit; border: 1px solid currentColor; border-radius: .25rem; padding: .3rem; cursor: pointer; }
.login-footer { min-height: 4rem; border-top: 1px solid #ffffff09; color: #626c59; font-size: .6rem; }
@media (min-width: 48rem) { .login-page { padding: 0 3rem; } .login-main { grid-template-columns: 1.2fr 1fr; gap: 4rem; min-height: calc(100dvh - 10rem); align-items: center; padding: 3rem 0; } .login-values { display: grid; } .login-terrain { display: block; } .login-story { padding-top: 2rem; } .login-panel__content { padding: 2rem; } }
@media (min-width: 70rem) { .login-main { gap: 7rem; } .login-topbar { height: 7rem; } .login-main { min-height: calc(100dvh - 11rem); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
</style>
