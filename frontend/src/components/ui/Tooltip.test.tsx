import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('becomes visible on hover and hidden on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Remove item">
        <button type="button">X</button>
      </Tooltip>,
    );
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).not.toContain('opacity-100');

    await user.hover(screen.getByRole('button'));
    expect(tooltip.className).toContain('opacity-100');

    await user.unhover(screen.getByRole('button'));
    expect(tooltip.className).not.toContain('opacity-100');
  });
});
