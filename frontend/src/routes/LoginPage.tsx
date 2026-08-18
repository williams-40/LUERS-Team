import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/layout/Logo';
import type { ApiError } from '../lib/api-client';
import i18n from '../lib/i18n';

// Module-scope, so this can't use the useTranslation() hook — falls back to
// the shared i18n instance directly, same pattern as lib/labels.ts.
const loginSchema = z.object({
  username: z.string().min(1, i18n.t('login.usernameRequired')),
  password: z.string().min(1, i18n.t('login.passwordRequired')),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  if (isAuthenticated) {
    const from = (location.state as { from?: Location })?.from ?? '/';
    return <Navigate to={from as unknown as string} replace />;
  }

  const passwordReset = Boolean((location.state as { passwordReset?: boolean } | null)?.passwordReset);
  const registered = Boolean((location.state as { registered?: boolean } | null)?.registered);

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      await login(values);
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setServerError(
        apiError.status === 401 ? t('login.incorrectCredentials') : (apiError.detail ?? t('login.genericError')),
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo className="h-12 w-auto" />
        <h1 className="text-xl">{t('login.title')}</h1>
      </div>

      {passwordReset && (
        <p className="bg-status-good/10 text-status-good-ink mb-4 rounded-lg px-3 py-2 text-center text-sm font-semibold">
          {t('login.passwordResetNotice')}
        </p>
      )}

      {registered && (
        <p className="bg-status-good/10 text-status-good-ink mb-4 rounded-lg px-3 py-2 text-center text-sm font-semibold">
          Account created. Sign in with your new credentials.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-ink-secondary text-[12.5px] font-semibold">
            {t('login.username')}
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            aria-invalid={Boolean(errors.username)}
            {...register('username')}
          />
          {errors.username && <p className="text-status-critical text-xs">{errors.username.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-ink-secondary text-[12.5px] font-semibold">
              {t('login.password')}
            </label>
            <Link to="/forgot-password" className="text-brand text-[12.5px] font-semibold hover:underline">
              {t('login.forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
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

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? t('login.signingIn') : t('login.signIn')}
        </Button>

        <Link to="/register" className="text-brand text-center text-sm font-semibold hover:underline">
          Create an account
        </Link>
      </form>
    </div>
  );
}
