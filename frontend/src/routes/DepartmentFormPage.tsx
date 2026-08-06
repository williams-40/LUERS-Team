import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createDepartment,
  deleteDepartment,
  fetchDepartment,
  updateDepartment,
} from '../lib/departments-api';
import { fetchUsers } from '../lib/admin-users-api';
import { UserMultiSelect } from '../components/admin/UserMultiSelect';
import { Button } from '../components/ui/Button';
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

export function DepartmentFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const { show } = useToast();

  // Phase 14: Department Head/Responder is decoupled from the account
  // Role — any active user is eligible (Finance/HR/Library etc. have no
  // corresponding Role at all), so this is no longer filtered to
  // admin-tier roles.
  const { data: eligibleUsers } = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => fetchUsers({}),
  });

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
    if (!window.confirm(`Delete "${department?.name}"? This cannot be undone.`)) {
      return;
    }
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
      <h1 className="mb-6 text-2xl">{isEdit ? 'Edit department' : 'New department'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-ink-secondary text-[12.5px] font-semibold">
            Name
          </label>
          <input
            id="name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
          {errors.name && <p className="text-status-critical text-xs">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-ink-secondary text-[12.5px] font-semibold">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('description')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="head" className="text-ink-secondary text-[12.5px] font-semibold">
            Head
          </label>
          <select
            id="head"
            value={head}
            onChange={(e) => setValue('head', e.target.value)}
            className="rounded-lg border-[1.5px] border-ink/15 px-2.5 py-1.5 text-sm"
          >
            <option value="">No head assigned</option>
            {(eligibleUsers?.results ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
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
              onClick={() => void handleDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
