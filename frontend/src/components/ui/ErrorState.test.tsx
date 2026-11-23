import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders as an alert with a default title', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this");
  });

  it('renders a custom title and description', () => {
    render(<ErrorState title="Couldn't load the queue" description="Please try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the queue");
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again.');
  });
});
