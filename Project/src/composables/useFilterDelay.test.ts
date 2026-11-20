import { effectScope, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { FILTER_DELAY, searchTerm, useDebouncedValue } from './useFilterDelay';

describe('фильтры поиска', () => {
  it('учитывает три символа после удаления внешних пробелов', () => {
    expect(searchTerm('  як ')).toBe('');
    expect(searchTerm('  Яша ')).toBe('Яша');
    expect(searchTerm('🐾я')).toBe('');
  });
  it('применяет последнее значение и отменяет отложенную фильтрацию при уходе', async () => {
    vi.useFakeTimers();
    const scope = effectScope(), raw = ref('');
    try {
      const value = scope.run(() => useDebouncedValue(() => searchTerm(raw.value)))!;
      raw.value = 'сем'; await nextTick();
      vi.advanceTimersByTime(FILTER_DELAY - 1);
      raw.value = 'семья'; await nextTick();
      vi.advanceTimersByTime(FILTER_DELAY - 1); expect(value.value).toBe('');
      vi.advanceTimersByTime(1); expect(value.value).toBe('семья');
      raw.value = ''; await nextTick(); scope.stop();
      vi.advanceTimersByTime(FILTER_DELAY); expect(value.value).toBe('семья');
    } finally { scope.stop(); vi.useRealTimers(); }
  });
});
