import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../lib/toast-context';
import { Category, Status, Urgency } from '../../types/domain';
import type { ReportDetail, EmergencyDispatch, User } from '../../types/domain';
import { EmergencyActionsControl } from './EmergencyActionsControl';

vi.mock('../../lib/reports-api', () => ({
  acknowledgeEmergency: vi.fn(),
  respondToEmergency: vi.fn(),
  arriveAtEmergency: vi.fn(),
  cancelEmergency: vi.fn(),
  escalateEmergency: vi.fn(),
}));

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth }));

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 'responder-1',
    username: 'responder1',
    email: 'responder1@example.com',
    first_name: '',
    last_name: '',
    phone_number: null,
    role: { id: 'r1', slug: 'responder', label: 'Responder', description: '', is_builtin: true, is_active: true },
    permissions: ['view_admin_dashboard'],
    university_id: null,
    is_active: true,
    date_joined: new Date().toISOString(),
    must_change_password: false,
    ...overrides,
  };
}

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
    assigned_to: 'responder-1',
    assigned_to_username: 'responder1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    department_id: null,
    department_name: null,
    department_head_id: null,
    emergency_dispatch: baseDispatch(),
    metadata: {},
    evidence: [],
    reporter: 'someone-else',
    reporter_name: null,
    reporter_phone: null,
    ...overrides,
  };
}

function renderControl(report: ReportDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <EmergencyActionsControl report={report} onUpdated={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('EmergencyActionsControl', () => {
  it('shows Acknowledge for a brand-new report', () => {
    useAuth.mockReturnValue({ user: baseUser() });
    renderControl(baseReport({ status: Status.NEW }));
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('hides Acknowledge once status has already moved on, even if acknowledged_at was never set', () => {
    // The generic status dropdown (StatusUpdateControl) lets a responder
    // jump straight to IN_PROGRESS without ever clicking Acknowledge —
    // acknowledged_at stays null, but Acknowledge must not keep showing
    // as if nothing had happened (the backend's PANIC_STATUS_TRANSITIONS
    // rejects ACKNOWLEDGED from IN_PROGRESS anyway, so it only ever errored).
    useAuth.mockReturnValue({ user: baseUser() });
    renderControl(
      baseReport({
        status: Status.IN_PROGRESS,
        emergency_dispatch: baseDispatch(),
      }),
    );
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('hides Acknowledge once acknowledged_at is set, in the ordinary flow', () => {
    useAuth.mockReturnValue({ user: baseUser() });
    renderControl(
      baseReport({
        status: Status.ACKNOWLEDGED,
        emergency_dispatch: baseDispatch({ acknowledged_at: new Date().toISOString() }),
      }),
    );
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('shows Mark arrived only once in progress and not yet arrived, for the assigned responder', () => {
    useAuth.mockReturnValue({ user: baseUser() });
    renderControl(
      baseReport({
        status: Status.IN_PROGRESS,
        emergency_dispatch: baseDispatch({ acknowledged_at: new Date().toISOString(), responding_at: new Date().toISOString() }),
      }),
    );
    expect(screen.getByRole('button', { name: 'Mark arrived' })).toBeInTheDocument();
  });
});
