import { computed, ref, shallowReactive } from 'vue';
import type { Activity } from '@shared/contracts';
export type RealtimeMessage = { type: 'invalidate'; resource: string } | { type: 'activity'; data: Activity };
type Listener = (message: RealtimeMessage) => void;
const online = shallowReactive(new Set<string>());
const presenceKnown = ref(false);

export function userPresence(id: string): 'online' | 'offline' | 'unknown' {
  return presenceKnown.value ? (online.has(id) ? 'online' : 'offline') : 'unknown';
}

export const onlineCount = computed(() => presenceKnown.value ? online.size : null);
export function onlineIds() { return presenceKnown.value ? [...online] : null; }

function clearPresence() {
  presenceKnown.value = false;
  online.clear();
}

function isUserList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string');
}

const listeners = new Set<Listener>();
let socket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let enabled = false;
const dirty = new Set<string>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function publish(message: RealtimeMessage): void {
  for (const listener of listeners) {
    try { listener(message); }
    catch (error) { console.error('Realtime subscriber failed', error); }
  }
}

function scheduleRefresh(): void {
  if (!dirty.size || document.hidden || refreshTimer) return;
  // Spread refreshes from different browsers after a shared community update.
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    if (document.hidden) return;
    const resources = [...dirty];
    dirty.clear();
    for (const resource of resources) publish({ type: 'invalidate', resource });
  }, 500 + Math.random() * 2000);
}

function invalidate(resource: string): void {
  if (resource === '*') dirty.clear();
  if (!dirty.has('*')) dirty.add(resource);
  scheduleRefresh();
}

function connect(): void {
  if (!enabled || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  const connection = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
  socket = connection;
  connection.onopen = () => {
    if (connection !== socket) return;
    attempts = 0;
    if (listeners.size) invalidate('*');
  };
  connection.onmessage = (event) => {
    if (connection !== socket) return;
    try {
      const message: unknown = JSON.parse(String(event.data));
      if (!message || typeof message !== 'object' || !('type' in message)) return;
      if (message.type === 'presence') {
        if ('online' in message && isUserList(message.online)) {
          online.clear();
          for (const id of message.online) online.add(id);
          presenceKnown.value = true;
        } else if (presenceKnown.value && 'joined' in message && 'left' in message && isUserList(message.joined) && isUserList(message.left)) {
          for (const id of message.joined) online.add(id);
          for (const id of message.left) online.delete(id);
        }
      } else if (message.type === 'invalidate' && 'resource' in message && typeof message.resource === 'string') {
        invalidate(message.resource);
      } else if (message.type === 'activity' && 'data' in message) {
        publish(message as RealtimeMessage);
      }
    } catch { /* A malformed event must not interrupt other application modules. */ }
  };
  connection.onclose = event => {
    if (socket !== connection) return;
    socket = undefined;
    clearPresence();
    if (!enabled) return;
    if (event.code === 4001 && event.reason === 'Session expired') {
      window.dispatchEvent(new Event('klan:unauthorized'));
      return;
    }
    const delay = Math.min(30_000, 2_000 * 2 ** attempts++);
    reconnectTimer = setTimeout(connect, delay * (0.5 + Math.random() * 0.5));
  };
  connection.onerror = () => connection.close();
}
export function startRealtime(): void {
  enabled = true;
  document.addEventListener('visibilitychange', scheduleRefresh);
  connect();
}
export function stopRealtime(): void {
  enabled = false;
  clearPresence();
  document.removeEventListener('visibilitychange', scheduleRefresh);
  clearTimeout(refreshTimer);
  refreshTimer = undefined;
  dirty.clear();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  socket?.close();
  socket = undefined;
}
export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
