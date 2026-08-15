import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Category, Status, Urgency } from '../types/domain';
import type { ReportListItem } from '../types/domain';
import { ReportCard } from './ReportCard';

function baseReport(overrides: Partial<ReportListItem> = {}): ReportListItem {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    category: Category.THEFT,
    category_display: 'Theft',
    description: 'Someone took my bike from the rack.',
    urgency: Urgency.NORMAL,
    urgency_display: 'Normal',
    status: Status.NEW,
    status_display: 'New',
    latitude: null,
    longitude: null,
    location_accuracy: null,
    assigned_to: null,
    assigned_to_username: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    evidence_count: 0,
    deleted_at: null,
    department_id: null,
    department_name: null,
    department_head_id: null,
    ...overrides,
  };
}

function renderCard(report: ReportListItem) {
  return render(
    <MemoryRouter>
      <ReportCard report={report} />
    </MemoryRouter>,
  );
}

describe('ReportCard', () => {
  it('links to the report detail route', () => {
    const report = baseReport();
    renderCard(report);
    expect(screen.getByRole('link')).toHaveAttribute('href', `/reports/${report.id}`);
  });

  it('shows the category, description, and status', () => {
    renderCard(baseReport());
    expect(screen.getByText('Theft')).toBeInTheDocument();
    expect(screen.getByText('Someone took my bike from the rack.')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows the evidence count only when there is evidence', () => {
    const { rerender } = renderCard(baseReport({ evidence_count: 0 }));
    expect(screen.queryByText(/file/)).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ReportCard report={baseReport({ evidence_count: 1 })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('pluralizes multiple evidence files', () => {
    renderCard(baseReport({ evidence_count: 3 }));
    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('shows the assigned officer when present', () => {
    renderCard(baseReport({ assigned_to: 'u1', assigned_to_username: 'officer_jane' }));
    expect(screen.getByText('@officer_jane')).toBeInTheDocument();
  });

  function minutesAgo(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
  }

  it.each([
    [0, 'just now'],
    [5, '5 min ago'],
    [90, '2 hr ago'],
    [60 * 24, 'yesterday'],
    [60 * 24 * 3, '3 days ago'],
  ])('renders relative time %i minutes ago as "%s"', (minutes, expected) => {
    renderCard(baseReport({ updated_at: minutesAgo(minutes) }));
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
