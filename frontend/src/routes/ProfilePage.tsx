import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { ROLE_LABELS } from '../lib/labels';
import { changePassword, updateMe } from '../lib/auth-api';
import type { ApiError } from '../lib/api-client';

const profileSchema = z.object({
  first_name: z.string().max(150).optional().or(z.literal('')),
  last_name: z.string().max(150).optional().or(z.literal('')),
  phone_number: z.string().max(15).optional().or(z.literal('')),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

function ProfileForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      phone_number: user?.phone_number ?? '',
      email: user?.email ?? '',
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    setServerError(null);
    setSaved(false);
    try {
      const updated = await updateMe(values);
      queryClient.setQueryData(['auth', 'me'], updated);
      setSaved(true);
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.email?.[0];
      setServerError(fieldError ?? apiError.detail);
    }
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
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            aria-invalid={Boolean(errors.first_name)}
            {...register('first_name')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="last_name" className="text-ink-secondary text-[12.5px] font-semibold">
            Last name
          </label>
          <input
            id="last_name"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            aria-invalid={Boolean(errors.last_name)}
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
          type="tel"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.phone_number)}
          {...register('phone_number')}
        />
        {errors.phone_number && <p className="text-status-critical text-xs">{errors.phone_number.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-ink-secondary text-[12.5px] font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && <p className="text-status-critical text-xs">{errors.email.message}</p>}
      </div>

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}
      {saved && !serverError && (
        <p role="status" className="bg-status-good/10 text-status-good rounded-lg px-3 py-2 text-sm">
          Profile updated.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSubmit(values: PasswordFormValues) {
    setServerError(null);
    setChanged(false);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setChanged(true);
      reset();
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.current_password?.[0] ?? apiError.fieldErrors?.new_password?.[0];
      setServerError(fieldError ?? apiError.detail);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="text-ink-secondary text-[12.5px] font-semibold">
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.currentPassword)}
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <p className="text-status-critical text-xs">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="text-ink-secondary text-[12.5px] font-semibold">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.newPassword)}
          {...register('newPassword')}
        />
        {errors.newPassword && <p className="text-status-critical text-xs">{errors.newPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-ink-secondary text-[12.5px] font-semibold">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="focus:outline-brand rounded-[9px] border-[1.5px] border-black/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-status-critical text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
          {serverError}
        </p>
      )}
      {changed && !serverError && (
        <p role="status" className="bg-status-good/10 text-status-good rounded-lg px-3 py-2 text-sm">
          Password changed.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">My profile</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Signed in as {user ? (ROLE_LABELS[user.role] ?? user.role) : '…'}.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Profile details</h2>
        <ProfileForm />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
