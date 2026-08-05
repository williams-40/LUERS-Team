import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '../../types/domain';
import { UserMultiSelect } from './UserMultiSelect';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'officer_jane',
    email: 'jane@example.com',
    first_name: '',
    last_name: '',
    phone_number: null,
    role: { id: 'r1', slug: 'security', label: 'Security Officer', description: '', is_builtin: true, is_active: true },
    permissions: ['view_admin_dashboard', 'manage_audit_logs'],
    university_id: null,
    is_active: true,
    date_joined: new Date().toISOString(),
    ...overrides,
  };
}

describe('UserMultiSelect', () => {
  it('renders one row per user', () => {
    const users = [makeUser({ id: 'u1', username: 'a' }), makeUser({ id: 'u2', username: 'b' })];
    render(<UserMultiSelect users={users} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('shows a fallback message when there are no users', () => {
    render(<UserMultiSelect users={[]} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no users available/i)).toBeInTheDocument();
  });

  it('checks boxes matching the value prop', () => {
    const users = [makeUser({ id: 'u1', username: 'a' }), makeUser({ id: 'u2', username: 'b' })];
    render(<UserMultiSelect users={users} value={['u2']} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'a' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'b' })).toBeChecked();
  });

  it('adds an id to the selection when its checkbox is checked', async () => {
    const onChange = vi.fn();
    const users = [makeUser({ id: 'u1', username: 'a' })];
    render(<UserMultiSelect users={users} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'a' }));
    expect(onChange).toHaveBeenCalledWith(['u1']);
  });

  it('removes an id from the selection when its checkbox is unchecked', async () => {
    const onChange = vi.fn();
    const users = [makeUser({ id: 'u1', username: 'a' }), makeUser({ id: 'u2', username: 'b' })];
    render(<UserMultiSelect users={users} value={['u1', 'u2']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'a' }));
    expect(onChange).toHaveBeenCalledWith(['u2']);
  });
});
