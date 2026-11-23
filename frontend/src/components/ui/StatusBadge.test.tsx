import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Status } from '../../types/domain';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    [Status.NEW, 'New'],
    [Status.ACKNOWLEDGED, 'Acknowledged'],
    [Status.IN_PROGRESS, 'In progress'],
    [Status.RESOLVED, 'Resolved'],
    [Status.CLOSED, 'Closed'],
  ])('renders the label for %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('applies an extra className alongside the status styling', () => {
    render(<StatusBadge status={Status.NEW} className="extra-class" />);
    expect(screen.getByText('New').closest('span')).toHaveClass('extra-class');
  });
});
