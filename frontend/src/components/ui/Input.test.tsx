import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
