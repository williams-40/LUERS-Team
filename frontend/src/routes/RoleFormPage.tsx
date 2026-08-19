import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { createRole, deleteRole, fetchPermissions, fetchRole, updateRole } from '../lib/roles-api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import type { ApiError } from '../lib/api-client';
import type { Permission } from '../types/domain';
import { useToast } from '../lib/toast-context';

const roleSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  label: z.string().trim().min(1, 'Label is required'),
  description: z.string(),
  permissions: z.array(z.string()),
  is_active: z.boolean(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export function RoleFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { show } = useToast();

  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
  });

  const { data: role, isLoading: isLoadingRole } = useQuery({
    queryKey: ['roles', id],
    queryFn: () => fetchRole(id!),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    values: role
      ? {
          slug: role.slug,
          label: role.label,
          description: role.description,
          permissions: role.permissions,
          is_active: role.is_active,
        }
      : { slug: '', label: '', description: '', permissions: [], is_active: true },
  });

  const createMutation = useMutation({ mutationFn: createRole });
  const updateMutation = useMutation({
    mutationFn: (values: RoleFormValues) => updateRole(id!, values),
  });
  const deleteMutation = useMutation({ mutationFn: () => deleteRole(id!) });

  const selectedPermissions = watch('permissions');
  const isActive = watch('is_active');

  function togglePermission(slug: string) {
    setValue(
      'permissions',
      selectedPermissions.includes(slug)
        ? selectedPermissions.filter((s) => s !== slug)
        : [...selectedPermissions, slug],
    );
  }

  async function onSubmit(values: RoleFormValues) {
    setServerError(null);
    try {
      if (isEdit) {
        const updated = await updateMutation.mutateAsync(values);
        queryClient.setQueryData(['roles', id], updated);
        show('Role updated.', 'success');
      } else {
        await createMutation.mutateAsync(values);
        show('Role created.', 'success');
      }
      navigate('/admin/roles');
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.slug?.[0] ?? apiError.fieldErrors?.label?.[0];
      const message = fieldError ?? apiError.detail;
      setServerError(message);
      show(message ?? 'Could not save this role.', 'error');
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    try {
      await deleteMutation.mutateAsync();
      show('Role deleted.', 'success');
      navigate('/admin/roles');
    } catch (err) {
      const message = (err as ApiError).detail;
      setServerError(message);
      show(message ?? 'Could not delete this role.', 'error');
    }
  }

  if (isEdit && isLoadingRole) {
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const isBuiltin = Boolean(role?.is_builtin);

  const permissionsByCategory = (permissions ?? []).reduce<Record<string, Permission[]>>((acc, p) => {
    const key = p.category || 'Other';
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Breadcrumbs items={[{ label: 'Roles', to: '/admin/roles' }, { label: isEdit ? 'Edit role' : 'New role' }]} />
      <h1 className="mb-1 text-2xl">{isEdit ? 'Edit role' : 'New role'}</h1>
      {isBuiltin && (
        <p className="bg-ink/5 text-ink-secondary mb-6 rounded-lg px-3 py-2 text-sm">
          This is a built-in role and cannot be edited or deleted.
        </p>
      )}

      <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input id="slug" label="Slug" disabled={isBuiltin || isEdit} error={errors.slug?.message} {...register('slug')} />

        <Input id="label" label="Label" disabled={isBuiltin} error={errors.label?.message} {...register('label')} />

        <Textarea id="description" label="Description" rows={2} disabled={isBuiltin} {...register('description')} />

        <div className="flex flex-col gap-2">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Permissions</span>
          {Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div key={category} className="rounded-lg border-[1.5px] border-ink/15 p-3">
              <h3 className="text-ink-muted mb-1.5 text-[11px] font-semibold uppercase">{category}</h3>
              <div className="flex flex-col gap-1.5">
                {perms.map((p) => (
                  <label key={p.slug} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="accent-brand mt-0.5 h-4 w-4"
                      disabled={isBuiltin}
                      checked={selectedPermissions.includes(p.slug)}
                      onChange={() => togglePermission(p.slug)}
                    />
                    <span className="text-sm">
                      {p.label}
                      {p.description && <span className="text-ink-muted block text-xs">{p.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-brand h-4 w-4"
            disabled={isBuiltin}
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

        {!isBuiltin && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create role'}
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
        )}
      </form>
      </Card>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${role?.label}"?`}
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
