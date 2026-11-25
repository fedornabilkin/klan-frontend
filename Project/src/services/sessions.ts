import type { ApiResponse } from '@shared/contracts';
import { api } from './api';

export interface ActiveSession {
  id: string;
  current: boolean;
  browser: string | null;
  os: string | null;
  ip: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
}
export interface SessionList {
  items: ActiveSession[];
  serverTime: string;
  revokeOthersAfter: string;
}
export const sessionsService = {
  async list(signal: AbortSignal) {
    return (await api.get<ApiResponse<SessionList>>('/auth/sessions', undefined, signal)).data;
  },
  revoke(id: string) { return api.delete('/auth/sessions/' + encodeURIComponent(id)); },
};
