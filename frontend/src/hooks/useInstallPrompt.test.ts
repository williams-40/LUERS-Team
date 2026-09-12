import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstallPrompt } from './useInstallPrompt';

function mockMatchMedia(standaloneMatches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('standalone') ? standaloneMatches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function setIosStandalone(value: boolean | undefined) {
  Object.defineProperty(window.navigator, 'standalone', { value, configurable: true });
}

class FakeBeforeInstallPromptEvent extends Event {
  prompt = vi.fn().mockResolvedValue(undefined);
  userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
  constructor() {
    super('beforeinstallprompt', { cancelable: true });
  }
}

describe('useInstallPrompt', () => {
  const defaultUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  beforeEach(() => {
    mockMatchMedia(false);
    setUserAgent(defaultUa);
    setIosStandalone(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with canInstall false and isInstalled false when not standalone', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('reports isInstalled true when display-mode is already standalone', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(true);
  });

  it('captures beforeinstallprompt, preventing the default browser UI, and flips canInstall', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = new FakeBeforeInstallPromptEvent();
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(true);
  });

  it('promptInstall() replays the captured event and clears canInstall afterward', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = new FakeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it('sets isInstalled and clears canInstall on the appinstalled event', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = new FakeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('detects iOS Safari (no beforeinstallprompt support) via user agent', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIosSafari).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('does not flag isIosSafari for iOS Chrome (CriOS), which is really Safari WebKit under the hood', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    );
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIosSafari).toBe(false);
  });

  it('does not flag isIosSafari once already installed (navigator.standalone true)', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    setIosStandalone(true);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isIosSafari).toBe(false);
  });
});
