import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/layout/Logo';
import { requestPasswordReset } from '../lib/auth-api';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    // The backend always responds the same way regardless of whether the
    // email matches an account, so there's nothing to branch on here.
    await requestPasswordReset(values.email);
    setSubmitted(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo className="h-12 w-auto" />
        <h1 className="text-xl">Forgot your password?</h1>
      </div>

      {submitted ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-ink-secondary text-sm">
            If an account exists for that email, we've sent a link to reset your password.
          </p>
          <Link to="/login" className="text-brand text-sm font-semibold hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <p className="text-ink-secondary text-sm">
            Enter the email associated with your account and we'll send you a link to reset your password.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-ink-secondary text-[12.5px] font-semibold">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
            {errors.email && <p className="text-status-critical text-xs">{errors.email.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>

          <Link to="/login" className="text-brand text-center text-sm font-semibold hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
