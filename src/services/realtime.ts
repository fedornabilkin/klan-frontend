import type { Activity } from '@shared/contracts';
export type RealtimeMessage = { type: 'invalidate'; resource: string } | { type: 'activity'; data: Activity };
type Listener = (message: RealtimeMessage) => void;
const listeners = new Set<Listener>();
let socket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let enabled = false;

function publish(message: RealtimeMessage): void {
  for (const listener of listeners) {
    try { listener(message); }
    catch (error) { console.error('Realtime subscriber failed', error); }
  }
}

function connect(): void {
  if (!enabled || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  const connection = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
  socket = connection;
  connection.onopen = () => { attempts = 0; publish({ type: 'invalidate', resource: '*' }); };
  connection.onmessage = (event) => {
    try {
      const message: unknown = JSON.parse(String(event.data));
      if (!message || typeof message !== 'object' || !('type' in message)) return;
      if (message.type === 'invalidate' && 'resource' in message && typeof message.resource === 'string') {
        publish(message as RealtimeMessage);
      } else if (message.type === 'activity' && 'data' in message) {
        publish(message as RealtimeMessage);
      }
    } catch { /* A malformed event must not interrupt other application modules. */ }
  };
  connection.onclose = () => {
    if (socket !== connection) return;
    socket = undefined;
    if (!enabled) return;
    reconnectTimer = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempts++) + Math.random() * 500);
  };
  connection.onerror = () => connection.close();
}
export function startRealtime(): void { enabled = true; connect(); }
export function stopRealtime(): void {
  enabled = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  socket?.close();
  socket = undefined;
}
export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
