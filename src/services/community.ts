import type { ApiResponse, Dashboard, ListResponse, Resource, Statistics, Tag } from '@shared/contracts';
import { buildActivity, buildResource, buildTag, CommunityEntity, EntityBuilder, object, UserModel } from '@/domain/builders';
import { api, type Query } from './api';

export const communityService = {
  async list(resource: Resource, query?: Query, signal?: AbortSignal): Promise<ListResponse<UserModel | CommunityEntity>> {
    const response = await api.get<ListResponse<unknown>>(`/${resource}`, query, signal);
    if (!Array.isArray(response.data)) throw new Error('Некорректный список в ответе сервера.');
    const meta = object(response.meta, 'meta');
    for (const key of ['page', 'limit', 'total', 'pages']) {
      if (typeof meta[key] !== 'number' || !Number.isFinite(meta[key]) || (meta[key] as number) < 0) throw new Error('Некорректная пагинация сервера.');
    }
    return { data: response.data.map(dto => buildResource(resource, dto)), meta: response.meta };
  },
  async get(resource: Resource, id: string, signal?: AbortSignal): Promise<UserModel | CommunityEntity> {
    const response = await api.get<ApiResponse<unknown>>(`/${resource}/${encodeURIComponent(id)}`, undefined, signal);
    return buildResource(resource, response.data);
  },
  async tags(signal?: AbortSignal): Promise<Tag[]> {
    const response = await api.get<ApiResponse<unknown[]>>('/tags', undefined, signal);
    return response.data.map(buildTag);
  },
  async dashboard(signal?: AbortSignal): Promise<Dashboard> {
    const response = await api.get<ApiResponse<Dashboard>>('/dashboard', undefined, signal);
    const dto = response.data;
    return { ...dto, events: dto.events.map(v => new EntityBuilder().from(v).build()), challenges: dto.challenges.map(v => new EntityBuilder().from(v).build()), teams: dto.teams.map(v => new EntityBuilder().from(v).build()), activity: dto.activity.map(buildActivity) };
  },
  async stats(signal?: AbortSignal): Promise<Statistics> {
    const response = await api.get<ApiResponse<Statistics>>('/stats', undefined, signal);
    object(response.data, 'stats');
    return response.data;
  },
};
