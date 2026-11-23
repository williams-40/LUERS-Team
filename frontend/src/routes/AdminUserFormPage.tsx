import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, fetchUser, updateUser } from '../lib/admin-users-api';
import { createDepartmentHead, fetchDepartments } from '../lib/departments-api';
import { RoleSelect } from '../components/admin/RoleSelect';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import type { ApiError } from '../lib/api-client';
import { useToast } from '../lib/toast-context';
import { useAuth } from '../hooks/useAuth';

// A department_head's account is always created department-scoped (see
// createDepartmentHead) so it gets the same temp-password/invite-email
// provisioning as every other head/responder — the schema branches on role
// rather than accepting a password for that case.
function buildCreateUserSchema(isDepartmentHead: boolean) {
  return z.object({
    username: z.string().trim().min(1, 'Username is required'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    first_name: z.string().optional().or(z.literal('')),
    last_name: z.string().optional().or(z.literal('')),
    phone_number: z.string().optional().or(z.literal('')),
    university_id: z.string().optional().or(z.literal('')),
    role: z.string().min(1, 'Please select a role'),
    password: isDepartmentHead
      ? z.string().optional().or(z.literal(''))
      : z.string().min(8, 'Password must be at least 8 characters'),
    department: isDepartmentHead
      ? z.string().min(1, 'Please select a department')
      : z.string().optional().or(z.literal('')),
  });
}

interface CreateUserFormValues {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  university_id?: string;
  role: string;
  password: string | undefined;
  department: string | undefined;
}

const editUserSchema = z.object({
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
  phone_number: z.string().optional().or(z.literal('')),
  university_id: z.string().optional().or(z.literal('')),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.string().min(1, 'Please select a role'),
  is_active: z.boolean(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

function fieldErrorFor(err: unknown, field: string): string | undefined {
  return (err as ApiError).fieldErrors?.[field]?.[0];
}

function CreateUserForm() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { show } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: (values, context, options) =>
      zodResolver(buildCreateUserSchema(values.role === 'department_head'))(values, context, options),
    defaultValues: { role: '' },
  });

  const createMutation = useMutation({ mutationFn: createUser });
  const createHeadMutation = useMutation({
    mutationFn: ({ departmentId, input }: { departmentId: string; input: Parameters<typeof createDepartmentHead>[1] }) =>
      createDepartmentHead(departmentId, input),
  });
  const role = watch('role');
  const isDepartmentHead = role === 'department_head';
  const hasManageDepartments = Boolean(currentUser?.permissions.includes('manage_departments'));

  const { data: departments } = useQuery({
    queryKey: ['departments', 'active-for-head-creation'],
    queryFn: () => fetchDepartments({ is_active: true }),
    enabled: isDepartmentHead,
  });

  async function onSubmit(values: CreateUserFormValues) {
    setServerError(null);
    try {
      if (values.role === 'department_head') {
        const created = await createHeadMutation.mutateAsync({
          departmentId: values.department!,
          input: {
            username: values.username,
            email: values.email,
            first_name: values.first_name || '',
            last_name: values.last_name || '',
            phone_number: values.phone_number || '',
            university_id: values.university_id || '',
          },
        });
        show(`Invite sent to ${created.email}`, 'success');
      } else {
        await createMutation.mutateAsync({ ...values, password: values.password! });
        show('User created.', 'success');
      }
      navigate('/admin/users');
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError =
        fieldErrorFor(err, 'username') ??
        fieldErrorFor(err, 'email') ??
        fieldErrorFor(err, 'password') ??
        fieldErrorFor(err, 'department');
      const message = fieldError ?? apiError.detail;
      setServerError(message);
      show(message ?? 'Could not create this user.', 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input id="username" label="Username" required error={errors.username?.message} {...register('username')} />

      <Input id="email" type="email" label="Email" required error={errors.email?.message} {...register('email')} />

      <div className="grid grid-cols-2 gap-3">
        <Input id="first_name" label="First name" {...register('first_name')} />
        <Input id="last_name" label="Last name" {...register('last_name')} />
      </div>

      <Input id="phone_number" label="Phone number" {...register('phone_number')} />

      <Input id="university_id" label="University ID" {...register('university_id')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-ink-secondary text-[12.5px] font-semibold">
          Role
          <span className="text-status-critical ml-0.5">*</span>
        </label>
        <RoleSelect
          id="role"
          value={role}
          onChange={(r) => setValue('role', r)}
          excludeResponder
          excludeDepartmentHead={!hasManageDepartments}
        />
      </div>

      {isDepartmentHead && (
        <div className="flex flex-col gap-1.5">
          <Select id="department" label="Department" required error={errors.department?.message} {...register('department')}>
            <option value="">Select a department</option>
            {(departments?.results ?? []).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Select>
          <p className="text-ink-muted text-xs">
            A temporary password will be emailed to this account, so no password is set here.
          </p>
        </div>
      )}

      {!isDepartmentHead && (
        <Input
          id="password"
          type="password"
          label="Password"
          required
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
      )}

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Creating…' : 'Create user'}
      </Button>
    </form>
  );
}

function EditUserForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { show } = useToast();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => fetchUser(userId),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    values: user
      ? {
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number ?? '',
          university_id: user.university_id ?? '',
          email: user.email,
          role: user.role.slug,
          is_active: user.is_active,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditUserFormValues) => updateUser(userId, values),
  });
  const role = watch('role');
  const isActive = watch('is_active');

  async function onSubmit(values: EditUserFormValues) {
    setServerError(null);
    setSaved(false);
    try {
      const updated = await updateMutation.mutateAsync(values);
      queryClient.setQueryData(['admin', 'users', userId], updated);
      setSaved(true);
      show('User updated.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      const message = fieldErrorFor(err, 'email') ?? apiError.detail;
      setServerError(message);
      show(message ?? 'Could not save this user.', 'error');
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-10">
        <div className="border-brand h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input id="first_name" label="First name" {...register('first_name')} />
        <Input id="last_name" label="Last name" {...register('last_name')} />
      </div>

      <Input id="email" type="email" label="Email" required error={errors.email?.message} {...register('email')} />

      <Input id="phone_number" label="Phone number" {...register('phone_number')} />

      <Input id="university_id" label="University ID" {...register('university_id')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-ink-secondary text-[12.5px] font-semibold">
          Role
          <span className="text-status-critical ml-0.5">*</span>
        </label>
        <RoleSelect
          id="role"
          value={role}
          onChange={(r) => setValue('role', r)}
          excludeResponder={user.role.slug !== 'responder'}
          excludeDepartmentHead={user.role.slug !== 'department_head'}
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
      {!isActive && (
        <p className="text-status-critical -mt-2 text-xs">
          Deactivating this account will block future logins and revoke any current session.
        </p>
      )}

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}
      {saved && !serverError && (
        <p role="status" className="bg-status-good/10 text-status-good rounded-lg px-3 py-2 text-sm">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

export function AdminUserFormPage() {
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Breadcrumbs items={[{ label: 'Users', to: '/admin/users' }, { label: id ? 'Edit user' : 'New user' }]} />
      <h1 className="mb-6 text-2xl">{id ? 'Edit user' : 'New user'}</h1>
      <Card>{id ? <EditUserForm userId={id} /> : <CreateUserForm />}</Card>
    </div>
  );
}
