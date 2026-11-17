import { onScopeDispose } from 'vue';
import { subscribeRealtime, type RealtimeMessage } from '@/services/realtime';
export function useRealtime(listener: (message: RealtimeMessage) => void): void {
  const unsubscribe = subscribeRealtime(listener);
  onScopeDispose(unsubscribe);
}
