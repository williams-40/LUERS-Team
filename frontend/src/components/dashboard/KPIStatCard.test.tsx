import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPIStatCard } from './KPIStatCard';

describe('KPIStatCard', () => {
  it('renders the label and value', () => {
    render(<KPIStatCard label="Total" value={41} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
  });

  it('renders trend content when provided', () => {
    render(<KPIStatCard label="Open" value={27} trend={<span>+12%</span>} />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });
});
