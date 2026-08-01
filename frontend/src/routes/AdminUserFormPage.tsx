import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, fetchUser, updateUser } from '../lib/admin-users-api';
import { RoleSelect } from '../components/admin/RoleSelect';
import { Button } from '../components/ui/Button';
import { Role } from '../types/domain';
import type { ApiError } from '../lib/api-client';

const createUserSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
  phone_number: z.string().optional().or(z.literal('')),
  university_id: z.string().optional().or(z.literal('')),
  role: z.nativeEnum(Role),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
  phone_number: z.string().optional().or(z.literal('')),
  university_id: z.string().optional().or(z.literal('')),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.nativeEnum(Role),
  is_active: z.boolean(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

function fieldErrorFor(err: unknown, field: string): string | undefined {
  return (err as ApiError).fieldErrors?.[field]?.[0];
}

function CreateUserForm() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: Role.STUDENT },
  });

  const createMutation = useMutation({ mutationFn: createUser });
  const role = watch('role');

  async function onSubmit(values: CreateUserFormValues) {
    setServerError(null);
    try {
      await createMutation.mutateAsync(values);
      navigate('/admin/users');
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError =
        fieldErrorFor(err, 'username') ?? fieldErrorFor(err, 'email') ?? fieldErrorFor(err, 'password');
      setServerError(fieldError ?? apiError.detail);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-ink-secondary text-[12.5px] font-semibold">
          Username
        </label>
        <input
          id="username"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.username)}
          {...register('username')}
        />
        {errors.username && <p className="text-status-critical text-xs">{errors.username.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-ink-secondary text-[12.5px] font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && <p className="text-status-critical text-xs">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_name" className="text-ink-secondary text-[12.5px] font-semibold">
            First name
          </label>
          <input
            id="first_name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('first_name')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="last_name" className="text-ink-secondary text-[12.5px] font-semibold">
            Last name
          </label>
          <input
            id="last_name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('last_name')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone_number" className="text-ink-secondary text-[12.5px] font-semibold">
          Phone number
        </label>
        <input
          id="phone_number"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          {...register('phone_number')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="university_id" className="text-ink-secondary text-[12.5px] font-semibold">
          University ID
        </label>
        <input
          id="university_id"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          {...register('university_id')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-ink-secondary text-[12.5px] font-semibold">
          Role
        </label>
        <RoleSelect id="role" value={role} onChange={(r) => setValue('role', r)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-ink-secondary text-[12.5px] font-semibold">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password && <p className="text-status-critical text-xs">{errors.password.message}</p>}
      </div>

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
          role: user.role,
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
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(fieldErrorFor(err, 'email') ?? apiError.detail);
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="first_name" className="text-ink-secondary text-[12.5px] font-semibold">
            First name
          </label>
          <input
            id="first_name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('first_name')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="last_name" className="text-ink-secondary text-[12.5px] font-semibold">
            Last name
          </label>
          <input
            id="last_name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('last_name')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-ink-secondary text-[12.5px] font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && <p className="text-status-critical text-xs">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone_number" className="text-ink-secondary text-[12.5px] font-semibold">
          Phone number
        </label>
        <input
          id="phone_number"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          {...register('phone_number')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="university_id" className="text-ink-secondary text-[12.5px] font-semibold">
          University ID
        </label>
        <input
          id="university_id"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          {...register('university_id')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-ink-secondary text-[12.5px] font-semibold">
          Role
        </label>
        <RoleSelect id="role" value={role} onChange={(r) => setValue('role', r)} />
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
      <h1 className="mb-6 text-2xl">{id ? 'Edit user' : 'New user'}</h1>
      {id ? <EditUserForm userId={id} /> : <CreateUserForm />}
    </div>
  );
}
