import { useCallback, useEffect, useState } from 'react';

/**
 * Chrome/Edge/Android-only event, not in lib.dom.d.ts. Firing it and calling
 * preventDefault() defers the browser's own install UI so we can trigger it
 * later from our own "Install app" button instead.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneDisplay(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari has no display-mode media query support; it sets this instead.
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

/** iOS Safari never fires beforeinstallprompt — it needs manual "Share -> Add to Home Screen" instructions instead. */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export interface UseInstallPromptResult {
  /** True once a real beforeinstallprompt event is ready to be replayed (Chrome/Edge/Android). */
  canInstall: boolean;
  /** True if already running as an installed/standalone app. */
  isInstalled: boolean;
  /** True on iOS Safari, which needs manual instructions instead of a native prompt. */
  isIosSafari: boolean;
  promptInstall: () => Promise<void>;
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setIsInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }, [deferredEvent]);

  return {
    canInstall: Boolean(deferredEvent) && !isInstalled,
    isInstalled,
    isIosSafari: isIosSafari() && !isInstalled,
    promptInstall,
  };
}
