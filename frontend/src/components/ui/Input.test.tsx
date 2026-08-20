import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="Full name" />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('marks the field invalid and shows the error message', () => {
    render(<Input label="Email" error="Enter a valid email address." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });

  it('renders helper text when there is no error', () => {
    render(<Input label="Phone" helperText="Include country code." />);
    expect(screen.getByText('Include country code.')).toBeInTheDocument();
  });

  it('does not render a reveal toggle for non-password fields', () => {
    render(<Input label="Username" type="text" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles a password field between hidden and revealed', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
