import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Category } from '../../types/domain';
import { CategoryPicker } from './CategoryPicker';

describe('CategoryPicker', () => {
  it('renders one radio per category', () => {
    render(<CategoryPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(Object.values(Category).length);
  });

  it('marks the selected category as checked', () => {
    render(<CategoryPicker value={Category.FIRE} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Fire' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Theft' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the clicked category', async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value={undefined} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Assault' }));
    expect(onChange).toHaveBeenCalledWith(Category.ASSAULT);
  });
});
