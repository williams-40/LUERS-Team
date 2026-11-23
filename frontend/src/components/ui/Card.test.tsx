import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children within the card shell', () => {
    render(<Card>Panel content</Card>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('merges an extra className', () => {
    render(<Card className="extra-class">content</Card>);
    expect(screen.getByText('content')).toHaveClass('extra-class');
  });
});
