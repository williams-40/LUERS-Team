import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { createDepartmentResponder, fetchDepartments, HEAD_DETECTION_DEPARTMENTS_QUERY_KEY } from '../../lib/departments-api';
import { fetchDashboardAnalytics } from '../../lib/dashboard-api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../lib/toast-context';
import type { ApiError } from '../../lib/api-client';

const responderSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.string().trim().email('Enter a valid email'),
  first_name: z.string().trim(),
  last_name: z.string().trim(),
  phone_number: z.string().trim(),
  university_id: z.string().trim(),
});
type ResponderFormValues = z.infer<typeof responderSchema>;
const EMPTY_VALUES: ResponderFormValues = {
  username: '', email: '', first_name: '', last_name: '', phone_number: '', university_id: '',
};

function AddResponderForm({ departmentId, onCreated }: { departmentId: string; onCreated: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<ResponderFormValues>({ resolver: zodResolver(responderSchema), defaultValues: EMPTY_VALUES });
  const mutation = useMutation({
    mutationFn: (values: ResponderFormValues) => createDepartmentResponder(departmentId, values),
  });

  async function onSubmit(values: ResponderFormValues) {
    setServerError(null);
    try {
      const created = await mutation.mutateAsync(values);
      onCreated(created.email);
      reset(EMPTY_VALUES);
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.username?.[0] ?? apiError.fieldErrors?.email?.[0];
      setServerError(fieldError ?? apiError.detail ?? 'Could not create this responder.');
    }
  }

  const fieldId = (name: string) => `${departmentId}-responder-${name}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3 flex flex-col gap-3 rounded-lg border border-ink/10 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('username')} className="text-ink-secondary text-[12px] font-semibold">
            Username
          </label>
          <input
            id={fieldId('username')}
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            aria-invalid={Boolean(errors.username)}
            {...register('username')}
          />
          {errors.username && <p className="text-status-critical text-xs">{errors.username.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('email')} className="text-ink-secondary text-[12px] font-semibold">
            Email
          </label>
          <input
            id={fieldId('email')}
            type="email"
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && <p className="text-status-critical text-xs">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('first_name')} className="text-ink-secondary text-[12px] font-semibold">
            First name
          </label>
          <input
            id={fieldId('first_name')}
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            {...register('first_name')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('last_name')} className="text-ink-secondary text-[12px] font-semibold">
            Last name
          </label>
          <input
            id={fieldId('last_name')}
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            {...register('last_name')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('phone_number')} className="text-ink-secondary text-[12px] font-semibold">
            Phone (optional)
          </label>
          <input
            id={fieldId('phone_number')}
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            {...register('phone_number')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId('university_id')} className="text-ink-secondary text-[12px] font-semibold">
            University ID (optional)
          </label>
          <input
            id={fieldId('university_id')}
            className="bg-surface-2 text-ink appearance-none rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2 text-sm"
            {...register('university_id')}
          />
        </div>
      </div>

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Add responder'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Phase 6: minimal "My Department → Responders" surface for a department
 * head — a roster of current members plus an inline add-responder form.
 * No role/department picker anywhere in this UI (matches the backend's
 * field-omission-based privilege-escalation guard): the department is
 * implicit from which card this is, and the created account is always
 * `responder`. Renders nothing for a user who doesn't head any
 * department. Deliberately reuses `DashboardSummaryPanel`'s exact
 * `['departments', { is_active: true, filter: true }]` query key so the
 * two panels share one fetch rather than issuing duplicate requests.
 */
export function MyDepartmentResponders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [openFormFor, setOpenFormFor] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: HEAD_DETECTION_DEPARTMENTS_QUERY_KEY,
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  const headedDepartments = (departments?.results ?? []).filter((d) => user && d.head === user.id);

  // Busy/free per responder (2026-08-17) — reuses the existing analytics
  // endpoint's responder_workload rather than a new one; matched by
  // username (unique) against member_usernames, not by index-pairing the
  // parallel members/member_usernames arrays, which aren't guaranteed to
  // stay in the same order. Only fetched once headedDepartments is
  // non-empty, since a plain responder never needs this.
  const { data: analytics } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: fetchDashboardAnalytics,
    enabled: headedDepartments.length > 0,
  });
  const openCountByUsername = new Map(
    (analytics?.responder_workload ?? []).map((w) => [w.username, w.open_count]),
  );

  if (headedDepartments.length === 0) return null;

  function handleCreated(email: string) {
    setOpenFormFor(null);
    void queryClient.invalidateQueries({ queryKey: HEAD_DETECTION_DEPARTMENTS_QUERY_KEY });
    show(`Invite sent to ${email}`, 'success');
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      {headedDepartments.map((department) => (
        <Card key={department.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-ink-secondary flex items-center gap-1.5 text-[12.5px] font-semibold">
              <Users className="h-4 w-4" aria-hidden />
              {department.name} Responders
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenFormFor(openFormFor === department.id ? null : department.id)}
            >
              {openFormFor === department.id ? 'Cancel' : 'Add responder'}
            </Button>
          </div>

          {department.member_usernames.length === 0 ? (
            <EmptyState title="No responders yet" className="items-start p-0 text-left" />
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {department.member_usernames.map((username) => {
                const openCount = openCountByUsername.get(username) ?? 0;
                return (
                  <li key={username} className="flex items-center justify-between">
                    <span>{username}</span>
                    <span className={openCount > 0 ? 'text-status-warning-ink' : 'text-status-good-ink'}>
                      {openCount > 0 ? `Busy (${openCount} open)` : 'Free'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {openFormFor === department.id && (
            <AddResponderForm departmentId={department.id} onCreated={handleCreated} />
          )}
        </Card>
      ))}
    </div>
  );
}
