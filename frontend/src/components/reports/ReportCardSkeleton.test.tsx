import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ReportCardSkeleton } from './ReportCardSkeleton';

describe('ReportCardSkeleton', () => {
  it('renders without throwing', () => {
    expect(() => render(<ReportCardSkeleton />)).not.toThrow();
  });

  it('renders the expected number of skeleton blocks', () => {
    const { container } = render(<ReportCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });
});
