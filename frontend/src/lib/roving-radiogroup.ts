import type { KeyboardEvent } from 'react';

const NAV_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']);

/**
 * Standard WAI-ARIA radiogroup keyboard behavior (arrow keys move AND select,
 * Home/End jump to the ends) for the custom pill-button radiogroups used
 * throughout the app (department/emergency-type/description-mode pickers,
 * theme toggle, feedback star rating) — previously each rendered
 * role="radio" buttons that were only mouse-operable. Pair with
 * `radioTabIndex` below so Tab only stops on the active option, matching
 * how a native radio group behaves.
 */
export function handleRadiogroupKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!NAV_KEYS.has(e.key)) return;
  e.preventDefault();

  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')).filter(
    (el) => !el.disabled,
  );
  if (radios.length === 0) return;

  const currentIndex = radios.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex: number;
  if (e.key === 'Home') nextIndex = 0;
  else if (e.key === 'End') nextIndex = radios.length - 1;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % radios.length;
  } else {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex - 1 + radios.length) % radios.length;
  }

  radios[nextIndex].focus();
  radios[nextIndex].click();
}

/** Only the active (or first, if none active yet) option is a Tab stop. */
export function radioTabIndex(active: boolean, isFirst: boolean, anyActive: boolean): 0 | -1 {
  if (active) return 0;
  return !anyActive && isFirst ? 0 : -1;
}
