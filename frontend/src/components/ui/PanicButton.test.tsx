import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanicButton } from './PanicButton';

describe('PanicButton', () => {
  it('renders the default label when no children are given', () => {
    render(<PanicButton />);
    expect(screen.getByRole('button', { name: 'Report Emergency Now' })).toBeInTheDocument();
  });

  it('renders custom children instead of the default label', () => {
    render(<PanicButton>Custom label</PanicButton>);
    expect(screen.getByRole('button', { name: 'Custom label' })).toBeInTheDocument();
  });

  it('fires onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<PanicButton onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled prop', () => {
    render(<PanicButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
