import { afterEach, expect, it, vi } from 'vitest';
import { startRealtime, stopRealtime, subscribeRealtime, userPresence } from './realtime';

class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static last: Socket;
  readyState = Socket.OPEN;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number; reason: string }) => void;
  constructor() { Socket.last = this; }
  close() {}
  invalidate(resource: string) {
    this.onmessage?.({ data: JSON.stringify({ type: 'invalidate', resource }) });
  }
}

afterEach(() => {
  stopRealtime();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('refreshes changed resources once when a tab returns, and stops on session expiry', () => {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const win = Object.assign(new EventTarget(), { location: new URL('http://localhost') });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('WebSocket', Socket);
  const listener = vi.fn(), revoked = vi.fn();
  const unsubscribe = subscribeRealtime(listener);
  try {
    startRealtime();
    const socket = Socket.last;
    socket.onopen?.();
    socket.invalidate('teams');
    vi.advanceTimersByTime(3000);
    expect(listener.mock.calls).toEqual([[{ type: 'invalidate', resource: '*' }]]);
    listener.mockClear();
    doc.hidden = true;
    socket.invalidate('teams');
    socket.invalidate('teams');
    socket.invalidate('dashboard');
    vi.advanceTimersByTime(10000);
    expect(listener).not.toHaveBeenCalled();
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(3000);
    expect(listener.mock.calls.map(([message]) => message.resource)).toEqual(['teams', 'dashboard']);
    win.addEventListener('klan:unauthorized', revoked);
    socket.onclose?.({ code: 4001, reason: 'Session expired' });
    vi.advanceTimersByTime(60000);
    expect(revoked).toHaveBeenCalledOnce();
    expect(Socket.last).toBe(socket);
  } finally { unsubscribe(); }
});

it('tracks presence separately from page refreshes and clears stale connections', () => {
  vi.useFakeTimers();
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: new URL('http://localhost') }));
  vi.stubGlobal('WebSocket', Socket);
  const listener = vi.fn();
  const unsubscribe = subscribeRealtime(listener);
  const send = (socket: Socket, data: object) => socket.onmessage?.({ data: JSON.stringify({ type: 'presence', ...data }) });
  try {
    startRealtime();
    const first = Socket.last;
    send(first, { joined: ['a'], left: [] });
    expect(userPresence('a')).toBe('unknown');
    send(first, { online: ['a', 'b'] });
    expect(userPresence('a')).toBe('online');
    expect(userPresence('c')).toBe('offline');
    send(first, { joined: ['c'], left: ['b'] });
    expect(userPresence('c')).toBe('online');
    expect(userPresence('b')).toBe('offline');
    first.onclose?.({ code: 1006, reason: '' });
    expect(userPresence('c')).toBe('unknown');
    vi.advanceTimersByTime(3000);
    send(Socket.last, { online: ['b'] });
    send(first, { joined: ['a'], left: ['b'] });
    expect(userPresence('b')).toBe('online');
    expect(userPresence('a')).toBe('offline');
    stopRealtime();
    expect(userPresence('b')).toBe('unknown');
    expect(listener).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});
