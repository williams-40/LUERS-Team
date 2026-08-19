import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Logo } from '../components/layout/Logo';
import { confirmPasswordReset } from '../lib/auth-api';
import type { ApiError } from '../lib/api-client';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  if (!uid || !token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-8 text-center">
        <p className="text-status-critical text-sm">This reset link is missing or malformed.</p>
        <Link to="/forgot-password" className="text-brand mt-3 text-sm font-semibold hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await confirmPasswordReset({ uid: uid!, token: token!, newPassword: values.newPassword });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = apiError.fieldErrors?.new_password?.[0];
      setServerError(fieldError ?? apiError.detail ?? 'This reset link is invalid or has expired.');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo className="h-12 w-auto" />
        <h1 className="text-xl">Choose a new password</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && (
          <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </div>
  );
}
