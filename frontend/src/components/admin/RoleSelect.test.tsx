import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Role } from '../../types/domain';
import { RoleSelect } from './RoleSelect';

describe('RoleSelect', () => {
  it('renders one option per role', () => {
    render(<RoleSelect value={Role.STUDENT} onChange={vi.fn()} />);
    expect(screen.getAllByRole('option')).toHaveLength(Object.values(Role).length);
  });

  it('reflects the current value', () => {
    render(<RoleSelect value={Role.SECURITY} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue(Role.SECURITY);
  });

  it('calls onChange with the selected role', async () => {
    const onChange = vi.fn();
    render(<RoleSelect value={Role.STUDENT} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), Role.ICT_ADMIN);
    expect(onChange).toHaveBeenCalledWith(Role.ICT_ADMIN);
  });
});
