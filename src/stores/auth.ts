import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ApiResponse } from '@shared/contracts';
import { levelCapabilities, type Capability } from '@shared/access';
import { UserBuilder, type UserModel } from '@/domain/builders';
import { api, ApiError, errorMessage } from '@/services/api';
import { startRealtime, stopRealtime } from '@/services/realtime';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserModel | null>(null);
  const ready = ref(false);
  const error = ref('');
  const isAdmin = computed(() => user.value?.role === 'admin');
  function can(capability: Capability): boolean {
    if (!user.value) return false;
    return (user.value.access?.capabilities ?? levelCapabilities[user.value.role === 'admin' ? 'admin' : 'member']).includes(capability);
  }
  let restoring: Promise<void> | undefined;
  function setUser(dto: unknown): void {
    user.value = new UserBuilder().from(dto).build();
    ready.value = true;
    error.value = '';
    startRealtime();
  }
  function clear(): void { user.value = null; ready.value = true; stopRealtime(); }
  window.addEventListener('klan:unauthorized', clear);
  function restore(force = false): Promise<void> {
    if (ready.value && !force) return Promise.resolve();
    if (restoring) return restoring;
    restoring = (async () => {
      try { const result = await api.get<ApiResponse<unknown>>('/auth/me'); setUser(result.data); }
      catch (cause) {
        clear();
        if (!(cause instanceof ApiError && cause.status === 401)) error.value = errorMessage(cause);
      } finally { ready.value = true; restoring = undefined; }
    })();
    return restoring;
  }
  async function demoLogin(): Promise<void> {
    const result = await api.post<ApiResponse<unknown>>('/auth/demo');
    setUser(result.data);
  }
  async function logout(): Promise<void> {
    await api.post('/auth/logout');
    clear();
  }
  return { user, ready, error, isAdmin, can, restore, demoLogin, logout, setUser };
});
