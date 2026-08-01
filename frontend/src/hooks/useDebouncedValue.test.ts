import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('first', 300));
    expect(result.current).toBe('first');
  });

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('first');
  });

  it('updates once the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('second');
  });

  it('resets the timer on rapid successive changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'third' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Only 200ms since the last change ("third") — should still be the pre-debounce value.
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('third');
  });
});
