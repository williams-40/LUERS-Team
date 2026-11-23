import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('associates the label with the select and renders options', () => {
    render(
      <Select label="Department">
        <option value="security">Security</option>
      </Select>,
    );
    const select = screen.getByLabelText('Department');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Security' })).toBeInTheDocument();
  });

  it('marks the field invalid and shows the error message', () => {
    render(
      <Select label="Department" error="Choose a department.">
        <option value="security">Security</option>
      </Select>,
    );
    expect(screen.getByLabelText('Department')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a department.');
  });
});
