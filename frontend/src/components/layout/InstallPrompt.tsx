import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

const DISMISS_KEY = 'luers-install-prompt-dismissed';

export function InstallPrompt() {
  const { t } = useTranslation();
  const { canInstall, isIosSafari, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');
  const [installing, setInstalling] = useState(false);

  if (dismissed || (!canInstall && !isIosSafari)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  }

  async function handleInstall() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="bg-brand/10 flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold">
      <span>{canInstall ? t('installPrompt.promptText') : t('installPrompt.iosText')}</span>
      {canInstall && (
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="text-brand underline disabled:opacity-50"
        >
          {installing ? t('installPrompt.installing') : t('installPrompt.install')}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('installPrompt.dismiss')}
        className="text-ink-muted"
      >
        ×
      </button>
    </div>
  );
}
