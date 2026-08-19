import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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

        <Input id="username" label="Username" autoComplete="username" error={errors.username?.message} {...register('username')} />

        <Input id="email" type="email" label="Email" autoComplete="email" error={errors.email?.message} {...register('email')} />

        <div className="grid grid-cols-2 gap-3">
          <Input id="first_name" label="First name" {...register('first_name')} />
          <Input id="last_name" label="Last name" {...register('last_name')} />
        </div>

        <Input id="phone_number" type="tel" label="Phone number" {...register('phone_number')} />

        <Input id="university_id" label="University ID" {...register('university_id')} />

        <Input
          id="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

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
