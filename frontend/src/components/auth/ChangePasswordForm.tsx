import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { changePassword } from '../../lib/auth-api';
import type { ApiError } from '../../lib/api-client';

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

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
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
      onSuccess?.();
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.current_password?.[0] ?? apiError.fieldErrors?.new_password?.[0];
      setServerError(fieldError ?? apiError.detail);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input
        id="currentPassword"
        type="password"
        label="Current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <Input
        id="newPassword"
        type="password"
        label="New password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <Input
        id="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

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
