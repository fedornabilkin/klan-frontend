import type { ApiResponse, UserIdentity } from '@shared/contracts';
import { api } from './api';

export interface AccessGroup { id: string; title: string }
export interface AccessSettings { revision: string | null; membersOnly: boolean; admins: UserIdentity[]; groups: AccessGroup[] }
const path = '/admin/access';
export const accessSettings = {
  async load() {
    return (await api.get<ApiResponse<AccessSettings>>(path)).data;
  },
  async resolve(address: string) {
    return (await api.post<ApiResponse<AccessGroup>>(path + '/resolve', { address })).data;
  },
  async save(revision: string | null, membersOnly: boolean, admins: UserIdentity[], groups: AccessGroup[]) {
    return (await api.put<ApiResponse<AccessSettings>>(path, {revision, membersOnly, adminIds:admins.map(user => user.id), groups})).data;
  },
};
