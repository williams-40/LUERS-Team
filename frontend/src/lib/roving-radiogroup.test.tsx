import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { handleRadiogroupKeyDown, radioTabIndex } from './roving-radiogroup';

function TestRadiogroup() {
  const [value, setValue] = useState('a');
  const options = ['a', 'b', 'c'];
  return (
    <div role="radiogroup" aria-label="Test" onKeyDown={handleRadiogroupKeyDown}>
      {options.map((opt, index) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          tabIndex={radioTabIndex(value === opt, index === 0, true)}
          onClick={() => setValue(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

describe('roving-radiogroup', () => {
  it('moves focus and selection to the next option on ArrowRight', async () => {
    const user = userEvent.setup();
    render(<TestRadiogroup />);
    screen.getByRole('radio', { name: 'a' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'b' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'b' })).toHaveAttribute('aria-checked', 'true');
  });

  it('wraps from the last option to the first on ArrowRight', async () => {
    const user = userEvent.setup();
    render(<TestRadiogroup />);
    screen.getByRole('radio', { name: 'c' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'a' })).toHaveFocus();
  });

  it('moves to the previous option on ArrowLeft', async () => {
    const user = userEvent.setup();
    render(<TestRadiogroup />);
    screen.getByRole('radio', { name: 'b' }).focus();

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('radio', { name: 'a' })).toHaveFocus();
  });

  it('jumps to the last option on End', async () => {
    const user = userEvent.setup();
    render(<TestRadiogroup />);
    screen.getByRole('radio', { name: 'a' }).focus();

    await user.keyboard('{End}');

    expect(screen.getByRole('radio', { name: 'c' })).toHaveFocus();
  });

  describe('radioTabIndex', () => {
    it('gives the checked option tabIndex 0', () => {
      expect(radioTabIndex(true, false, true)).toBe(0);
    });

    it('gives unchecked options tabIndex -1 once something is checked', () => {
      expect(radioTabIndex(false, true, true)).toBe(-1);
    });

    it('gives the first option tabIndex 0 when nothing is checked yet', () => {
      expect(radioTabIndex(false, true, false)).toBe(0);
    });

    it('gives non-first, unchecked options tabIndex -1 when nothing is checked yet', () => {
      expect(radioTabIndex(false, false, false)).toBe(-1);
    });
  });
});
