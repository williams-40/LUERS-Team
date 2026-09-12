import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Category, Status, Urgency } from '../../types/domain';
import type { ReportDetail, EmergencyDispatch } from '../../types/domain';
import { EmergencyStatusChecklist } from './EmergencyStatusChecklist';

function baseDispatch(overrides: Partial<EmergencyDispatch> = {}): EmergencyDispatch {
  return {
    emergency_type: 'security',
    emergency_type_display: 'Security / Threat',
    escalation_level: 0,
    acknowledged_at: null,
    acknowledged_by_username: null,
    responding_at: null,
    arrived_at: null,
    resolved_at: null,
    cancelled_at: null,
    ack_deadline: null,
    response_deadline: null,
    resolution_deadline: null,
    ...overrides,
  };
}

function baseReport(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    category: Category.THEFT,
    category_display: null,
    description: 'Fire in the library.',
    urgency: Urgency.PANIC,
    urgency_display: 'Panic',
    status: Status.NEW,
    status_display: 'New',
    latitude: null,
    longitude: null,
    location_accuracy: null,
    assigned_to: null,
    assigned_to_username: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    department_id: null,
    department_name: null,
    department_head_id: null,
    emergency_dispatch: baseDispatch(),
    metadata: {},
    evidence: [],
    reporter: null,
    reporter_name: null,
    reporter_phone: null,
    ...overrides,
  };
}

function stepDot(label: string): HTMLElement {
  return screen.getByText(label).previousElementSibling as HTMLElement;
}

describe('EmergencyStatusChecklist', () => {
  it('renders nothing for a report with no emergency_dispatch', () => {
    const { container } = render(<EmergencyStatusChecklist report={baseReport({ emergency_dispatch: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('only checks off steps whose own timestamp is set, in the ordinary click-through flow', () => {
    render(
      <EmergencyStatusChecklist
        report={baseReport({
          status: Status.ACKNOWLEDGED,
          emergency_dispatch: baseDispatch({ acknowledged_at: new Date().toISOString() }),
        })}
      />,
    );
    expect(stepDot('Responder acknowledged')).toHaveClass('bg-status-good');
    expect(stepDot('Responder on the way')).not.toHaveClass('bg-status-good');
    expect(stepDot('In progress')).not.toHaveClass('bg-status-good');
  });

  it('treats acknowledged and responding as done once status reaches in_progress, even with no timestamps set', () => {
    // The generic status dropdown lets a responder jump straight to
    // IN_PROGRESS without ever going through Acknowledge/Mark responding
    // (see StatusUpdateControl) — acknowledged_at/responding_at stay null,
    // but the report has clearly moved on and the checklist shouldn't
    // still show those earlier steps as if nothing had happened.
    render(
      <EmergencyStatusChecklist
        report={baseReport({ status: Status.IN_PROGRESS, emergency_dispatch: baseDispatch() })}
      />,
    );
    expect(stepDot('Responder acknowledged')).toHaveClass('bg-status-good');
    expect(stepDot('Responder on the way')).toHaveClass('bg-status-good');
    expect(stepDot('In progress')).toHaveClass('bg-status-good');
    expect(stepDot('Emergency resolved')).not.toHaveClass('bg-status-good');
  });

  it('checks every step once resolved', () => {
    render(
      <EmergencyStatusChecklist report={baseReport({ status: Status.RESOLVED, emergency_dispatch: baseDispatch() })} />,
    );
    for (const label of [
      'Emergency received',
      'Response team notified',
      'Responder acknowledged',
      'Responder on the way',
      'In progress',
      'Emergency resolved',
    ]) {
      expect(stepDot(label)).toHaveClass('bg-status-good');
    }
  });

  it('shows a cancelled banner with no checklist for a cancelled report', () => {
    render(
      <EmergencyStatusChecklist report={baseReport({ status: Status.CANCELLED, emergency_dispatch: baseDispatch() })} />,
    );
    expect(screen.getByText('Emergency cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Responder acknowledged')).not.toBeInTheDocument();
  });
});
