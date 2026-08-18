import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/layout/Logo';
import { register as registerAccount } from '../lib/auth-api';
import type { ApiError } from '../lib/api-client';

const registerSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
  phone_number: z.string().optional().or(z.literal('')),
  university_id: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'staff']),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function fieldErrorFor(err: unknown, field: string): string | undefined {
  return (err as ApiError).fieldErrors?.[field]?.[0];
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'student' },
  });

  const role = watch('role');

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      await registerAccount(values);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      const apiError = err as ApiError;
      const fieldError = fieldErrorFor(err, 'username') ?? fieldErrorFor(err, 'email') ?? fieldErrorFor(err, 'password');
      const message = fieldError ?? apiError.detail;
      setServerError(message ?? 'Could not create your account.');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo className="h-12 w-auto" />
        <h1 className="text-xl">Create an account</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">I am a</span>
          <div role="radiogroup" className="flex gap-2">
            {(['student', 'staff'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={role === option}
                onClick={() => setValue('role', option)}
                className={
                  role === option
                    ? 'bg-brand flex-1 rounded-[9px] px-3 py-2 text-sm font-semibold text-white'
                    : 'border-ink/15 text-ink-secondary flex-1 rounded-[9px] border-[1.5px] px-3 py-2 text-sm font-semibold'
                }
              >
                {option === 'student' ? 'Student' : 'Staff'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-ink-secondary text-[12.5px] font-semibold">
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
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
            autoComplete="email"
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
            type="tel"
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

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>

        <Link to="/login" className="text-brand text-center text-sm font-semibold hover:underline">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
