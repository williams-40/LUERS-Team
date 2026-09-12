import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useTheme, type Theme } from '../../lib/theme-context';
import { handleRadiogroupKeyDown, radioTabIndex } from '../../lib/roving-radiogroup';

const OPTIONS: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'system', labelKey: 'theme.system' },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label={t('theme.label')} className="inline-flex gap-1.5" onKeyDown={handleRadiogroupKeyDown}>
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          tabIndex={radioTabIndex(theme === option.value, index === 0, true)}
          variant={theme === option.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTheme(option.value)}
        >
          {t(option.labelKey)}
        </Button>
      ))}
    </div>
  );
}
