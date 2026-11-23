import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title, description, and action', () => {
    render(
      <EmptyState
        title="No reports yet"
        description="You haven't submitted any reports."
        action={<button type="button">Report an incident</button>}
      />,
    );
    expect(screen.getByText('No reports yet')).toBeInTheDocument();
    expect(screen.getByText("You haven't submitted any reports.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report an incident' })).toBeInTheDocument();
  });
});
