import { onScopeDispose, shallowRef, watch } from 'vue';

export const FILTER_DELAY = 300;
export function searchTerm(value: string): string {
  const text = value.trim();
  return Array.from(text).length >= 3 ? text : '';
}

export function useFilterDelay() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() { clearTimeout(timer); }
  function schedule(apply: () => void) {
    cancel();
    timer = setTimeout(apply, FILTER_DELAY);
  }
  onScopeDispose(cancel);
  return { schedule, cancel };
}

export function useDebouncedValue<T>(read: () => T) {
  const value = shallowRef<T>(read());
  const delay = useFilterDelay();
  watch(read, next => delay.schedule(() => { value.value = next; }));
  return value;
}
