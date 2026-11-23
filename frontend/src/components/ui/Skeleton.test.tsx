import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a pulsing placeholder element', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('animate-pulse', 'h-4', 'w-32');
    expect(el).toHaveAttribute('aria-hidden');
  });
});
