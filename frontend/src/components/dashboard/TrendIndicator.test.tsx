import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendIndicator } from './TrendIndicator';

describe('TrendIndicator', () => {
  it('shows a positive percentage when current exceeds previous', () => {
    render(<TrendIndicator current={44} previous={40} label="vs last month" />);
    expect(screen.getByText('+10.0%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('shows a negative percentage when current is below previous', () => {
    render(<TrendIndicator current={30} previous={40} label="vs last month" />);
    expect(screen.getByText('-25.0%')).toBeInTheDocument();
  });

  it('falls back to a plain delta when there is no previous baseline', () => {
    render(<TrendIndicator current={5} previous={0} label="new this month" />);
    expect(screen.getByText(/\+5/)).toBeInTheDocument();
  });
});
