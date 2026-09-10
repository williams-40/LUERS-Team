import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createEmergencyCategory,
  deleteEmergencyCategory,
  fetchEmergencyCategory,
  updateEmergencyCategory,
} from '../lib/emergency-categories-api';
import { fetchDepartments } from '../lib/departments-api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import type { ApiError } from '../lib/api-client';
import { useToast } from '../lib/toast-context';

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .regex(SLUG_PATTERN, 'Lowercase letters, numbers, hyphens, and underscores only'),
  description: z.string(),
  department: z.string(),
  requires_description_and_routing: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export function EmergencyCategoryFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { show } = useToast();

  const { data: departments } = useQuery({
    queryKey: ['departments', { is_active: true, picker: true }],
    queryFn: () => fetchDepartments({ is_active: true }),
  });

  const { data: category, isLoading: isLoadingCategory } = useQuery({
    queryKey: ['emergency-categories', id],
    queryFn: () => fetchEmergencyCategory(id!),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    values: category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description,
          department: category.department ?? '',
          requires_description_and_routing: category.requires_description_and_routing,
          is_active: category.is_active,
          sort_order: category.sort_order,
        }
      : {
          name: '',
          slug: '',
          description: '',
          department: '',
          requires_description_and_routing: false,
          is_active: true,
          sort_order: 0,
        },
  });

  const department = watch('department');
  const requiresRouting = watch('requires_description_and_routing');
  const isActive = watch('is_active');
  const sortOrder = watch('sort_order');

  const createMutation = useMutation({ mutationFn: createEmergencyCategory });
  const updateMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      updateEmergencyCategory(id!, { ...values, department: values.department || null }),
  });
  const deleteMutation = useMutation({ mutationFn: () => deleteEmergencyCategory(id!) });

  async function onSubmit(values: CategoryFormValues) {
    setServerError(null);
    try {
      if (isEdit) {
        const updated = await updateMutation.mutateAsync(values);
        queryClient.setQueryData(['emergency-categories', id], updated);
        show('Category updated.', 'success');
      } else {
        await createMutation.mutateAsync({ ...values, department: values.department || null });
        show('Category created.', 'success');
      }
      void queryClient.invalidateQueries({ queryKey: ['emergency-categories'] });
      navigate('/admin/emergency-categories');
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.name?.[0] ?? apiError.fieldErrors?.slug?.[0];
      const message = fieldError ?? apiError.detail;
      setServerError(message);
      show(message ?? 'Could not save this category.', 'error');
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    try {
      await deleteMutation.mutateAsync();
      void queryClient.invalidateQueries({ queryKey: ['emergency-categories'] });
      show('Category deleted.', 'success');
      navigate('/admin/emergency-categories');
    } catch (err) {
      const message = (err as ApiError).detail;
      setServerError(message);
      show(message ?? 'Could not delete this category.', 'error');
    }
  }

  if (isEdit && isLoadingCategory) {
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Breadcrumbs
        items={[
          { label: 'Emergency categories', to: '/admin/emergency-categories' },
          { label: isEdit ? 'Edit category' : 'New category' },
        ]}
      />
      <h1 className="mb-6 text-2xl">{isEdit ? 'Edit category' : 'New category'}</h1>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input id="name" label="Name" required error={errors.name?.message} {...register('name')} />

          <Input
            id="slug"
            label="Slug"
            required
            helperText="The value sent by the report form and stored on the report, e.g. security."
            error={errors.slug?.message}
            {...register('slug')}
          />

          <Textarea id="description" label="Description" rows={2} {...register('description')} />

          <Select
            id="department"
            label="Default department"
            value={department}
            onChange={(e) => setValue('department', e.target.value)}
          >
            <option value="">No default department</option>
            {(departments?.results ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="accent-brand mt-0.5 h-4 w-4"
              checked={requiresRouting}
              onChange={(e) => setValue('requires_description_and_routing', e.target.checked)}
            />
            <span className="text-sm">
              Requires a description to route
              <span className="text-ink-secondary block text-[12.5px]">
                A reporter must describe what's happening, and it's used to auto-route to a department by keyword
                (like the existing "Other" category). Leave off for categories with an obvious fixed department.
              </span>
            </span>
          </label>

          <Input
            id="sort_order"
            type="number"
            label="Sort order"
            helperText="Lower numbers appear first in the reporter's category picker."
            error={errors.sort_order?.message}
            value={sortOrder}
            onChange={(e) => setValue('sort_order', Number(e.target.value) || 0)}
          />

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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create category'}
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

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${category?.name}"?`}
          description="Existing reports keep their category label and stay unaffected. Reporters will no longer be able to pick this category for new reports."
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
