import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme-context';

function mockMatchMedia(initialMatches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null;
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    trigger(matches: boolean) {
      mql.matches = matches;
      listener?.({ matches } as MediaQueryListEvent);
    },
  };
}

describe('ThemeProvider / useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system and resolves dark when the OS prefers dark', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('defaults to system and resolves light when the OS prefers light', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme("dark") applies the .dark class and persists to localStorage', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('dark'));

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('luers-theme')).toBe('dark');
  });

  it('setTheme("light") removes the .dark class even if the OS prefers dark', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('light'));

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads a previously persisted theme from localStorage on mount', () => {
    localStorage.setItem('luers-theme', 'dark');
    mockMatchMedia(false);

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('live-updates resolvedTheme when the OS preference changes while on "system"', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.resolvedTheme).toBe('light');

    act(() => media.trigger(true));

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores an OS preference change while explicitly set to "light"', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => result.current.setTheme('light'));
    act(() => media.trigger(true));

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
  });
});
