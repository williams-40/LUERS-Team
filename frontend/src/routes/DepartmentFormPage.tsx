import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createDepartment,
  createDepartmentHead,
  deleteDepartment,
  fetchDepartment,
  updateDepartment,
  type ResponderInput,
} from '../lib/departments-api';
import { fetchUsers } from '../lib/admin-users-api';
import { UserMultiSelect } from '../components/admin/UserMultiSelect';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import type { ApiError } from '../lib/api-client';
import { useToast } from '../lib/toast-context';

const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  head: z.string(),
  members: z.array(z.string()),
  is_active: z.boolean(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

const headSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.string().trim().email('Enter a valid email'),
  first_name: z.string().trim(),
  last_name: z.string().trim(),
  phone_number: z.string().trim(),
  university_id: z.string().trim(),
});
type HeadFormValues = z.infer<typeof headSchema>;
const EMPTY_HEAD_VALUES: HeadFormValues = {
  username: '', email: '', first_name: '', last_name: '', phone_number: '', university_id: '',
};

function AddHeadForm({ departmentId, onCreated }: { departmentId: string; onCreated: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<HeadFormValues>({ resolver: zodResolver(headSchema), defaultValues: EMPTY_HEAD_VALUES });
  const mutation = useMutation({
    mutationFn: (values: ResponderInput) => createDepartmentHead(departmentId, values),
  });

  async function onSubmit(values: HeadFormValues) {
    setServerError(null);
    try {
      const created = await mutation.mutateAsync(values);
      onCreated(created.email);
      reset(EMPTY_HEAD_VALUES);
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.username?.[0] ?? apiError.fieldErrors?.email?.[0];
      setServerError(fieldError ?? apiError.detail ?? 'Could not create this head.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3 flex flex-col gap-3 rounded-lg border border-ink/10 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Input id="head-username" label="Username" required error={errors.username?.message} {...register('username')} />
        <Input id="head-email" type="email" label="Email" required error={errors.email?.message} {...register('email')} />
        <Input id="head-first_name" label="First name" {...register('first_name')} />
        <Input id="head-last_name" label="Last name" {...register('last_name')} />
      </div>

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create head'}
        </Button>
      </div>
    </form>
  );
}

export function DepartmentFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAddHead, setShowAddHead] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { show } = useToast();

  // Phase 14: Department Head/Responder is decoupled from the account
  // Role — any active user is eligible (Finance/HR/Library etc. have no
  // corresponding Role at all), so this is no longer filtered to
  // admin-tier roles. system_admin is excluded (below) rather than
  // allow-listing everyone else: an admin is oversight-only and shouldn't
  // be assignable as a responder, matching the backend's own
  // validate_members/validate_head rejection.
  const { data: allEligibleUsers } = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => fetchUsers({}),
  });
  const eligibleUsers = allEligibleUsers && {
    ...allEligibleUsers,
    results: allEligibleUsers.results.filter((u) => u.role.slug !== 'system_admin'),
  };

  const { data: department, isLoading: isLoadingDepartment } = useQuery({
    queryKey: ['departments', id],
    queryFn: () => fetchDepartment(id!),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    values: department
      ? {
          name: department.name,
          description: department.description,
          head: department.head ?? '',
          members: department.members,
          is_active: department.is_active,
        }
      : { name: '', description: '', head: '', members: [], is_active: true },
  });

  const createMutation = useMutation({ mutationFn: createDepartment });
  const updateMutation = useMutation({
    mutationFn: (values: DepartmentFormValues) => updateDepartment(id!, { ...values, head: values.head || null }),
  });
  const deleteMutation = useMutation({ mutationFn: () => deleteDepartment(id!) });

  const members = watch('members');
  const head = watch('head');
  const isActive = watch('is_active');

  async function onSubmit(values: DepartmentFormValues) {
    setServerError(null);
    try {
      if (isEdit) {
        const updated = await updateMutation.mutateAsync(values);
        queryClient.setQueryData(['departments', id], updated);
        show('Department updated.', 'success');
      } else {
        await createMutation.mutateAsync({ ...values, head: values.head || null });
        show('Department created.', 'success');
      }
      navigate('/admin/departments');
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.name?.[0] ?? apiError.fieldErrors?.head?.[0] ?? apiError.fieldErrors?.members?.[0];
      const message = fieldError ?? apiError.detail;
      setServerError(message);
      show(message ?? 'Could not save this department.', 'error');
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    try {
      await deleteMutation.mutateAsync();
      show('Department deleted.', 'success');
      navigate('/admin/departments');
    } catch (err) {
      const message = (err as ApiError).detail;
      setServerError(message);
      show(message ?? 'Could not delete this department.', 'error');
    }
  }

  if (isEdit && isLoadingDepartment) {
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Breadcrumbs
        items={[{ label: 'Departments', to: '/admin/departments' }, { label: isEdit ? 'Edit department' : 'New department' }]}
      />
      <h1 className="mb-6 text-2xl">{isEdit ? 'Edit department' : 'New department'}</h1>

      <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input id="name" label="Name" required error={errors.name?.message} {...register('name')} />

        <Textarea id="description" label="Description" rows={3} {...register('description')} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Head</span>
            {isEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddHead((v) => !v)}>
                {showAddHead ? 'Cancel' : 'Create a new head'}
              </Button>
            )}
          </div>
          <Select id="head" value={head} onChange={(e) => setValue('head', e.target.value)}>
            <option value="">No head assigned</option>
            {/* responder (plain members, reassignable to head elsewhere) and
                department_head (existing heads, reassignable to a different
                department) — this is a UI-only cleanup to stop an admin
                fat-fingering a student/staff/system_admin account into
                headship via this big dropdown; the backend itself stays
                permissive per its own Phase 14 decision to decouple
                headship from Role entirely. */}
            {(eligibleUsers?.results ?? [])
              .filter((user) => user.role.slug === 'responder' || user.role.slug === 'department_head')
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Members</span>
          <UserMultiSelect
            users={eligibleUsers?.results ?? []}
            value={members}
            onChange={(ids) => setValue('members', ids)}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-brand h-4 w-4"
            checked={isActive}
            onChange={(e) => setValue('is_active', e.target.checked)}
          />
          <span className="text-sm">Active</span>
        </label>

        {serverError && (
          <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create department'}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </form>
      </Card>

      {/* Deliberately outside the department <form> above — AddHeadForm
          renders its own <form>, and a nested <form> inside another is
          invalid HTML (the browser silently de-nests it, breaking submit
          entirely for whichever one loses). */}
      {isEdit && showAddHead && (
        <div className="mt-4">
          <AddHeadForm
            departmentId={id!}
            onCreated={(email) => {
              setShowAddHead(false);
              void queryClient.invalidateQueries({ queryKey: ['departments', id] });
              void queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'all'] });
              show(`Invite sent to ${email}`, 'success');
            }}
          />
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${department?.name}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
