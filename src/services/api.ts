export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code = 'REQUEST_FAILED') {
    super(message); this.name = 'ApiError';
  }
}
export type Query = Record<string, unknown>;
function url(path: string, query?: Query): string {
  const search = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return `${path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`}${search.size ? `?${search}` : ''}`;
}
async function request<T>(method: string, path: string, body?: unknown, query?: Query, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url(path, query), {
    method, credentials: 'same-origin', signal,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload: unknown;
  if (response.status !== 204) {
    try { payload = await response.json(); }
    catch { throw new ApiError('Сервер вернул неожиданный ответ. Попробуйте ещё раз.', response.status); }
  }
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as { error?: { message?: string; code?: string } }).error : undefined;
    if (response.status === 401) window.dispatchEvent(new CustomEvent('klan:unauthorized'));
    throw new ApiError(error?.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.', response.status, error?.code);
  }
  return payload as T;
}
export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, undefined, query, signal),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось загрузить данные.';
}
