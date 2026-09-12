import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PhoneInput } from '../components/ui/PhoneInput';
import { register as registerAccount } from '../lib/auth-api';
import type { ApiError } from '../lib/api-client';
import {
  DEFAULT_PHONE_COUNTRY,
  isValidNationalNumber,
  toE164,
  type PhoneCountry,
} from '../lib/phone-countries';

const registerSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    first_name: z.string().trim().min(1, 'First name is required'),
    last_name: z.string().trim().min(1, 'Last name is required'),
    university_id: z.string().trim().min(1, 'University ID is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['student', 'staff']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function fieldErrorFor(err: unknown, field: string): string | undefined {
  return (err as ApiError).fieldErrors?.[field]?.[0];
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [phoneNational, setPhoneNational] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

    // Checked here rather than in the zod schema since it depends on the
    // separately-tracked country picker, not a plain registered field.
    if (!phoneNational.trim()) {
      setPhoneError('Phone number is required.');
      return;
    }
    if (!isValidNationalNumber(phoneCountry, phoneNational)) {
      setPhoneError(
        `Enter a valid ${phoneCountry.minDigits === phoneCountry.maxDigits ? phoneCountry.minDigits : `${phoneCountry.minDigits}-${phoneCountry.maxDigits}`}-digit number for ${phoneCountry.name}.`,
      );
      return;
    }
    setPhoneError(null);

    try {
      await registerAccount({
        username: values.username,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        university_id: values.university_id,
        password: values.password,
        role: values.role,
        phone_number: toE164(phoneCountry, phoneNational),
      });
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
      <h1 className="mb-8 text-center text-xl">Create an account</h1>

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

        <Input
          id="username"
          label="Username"
          required
          autoComplete="username"
          error={errors.username?.message}
          {...register('username')}
        />

        <Input
          id="email"
          type="email"
          label="Email"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input id="first_name" label="First name" required error={errors.first_name?.message} {...register('first_name')} />
          <Input id="last_name" label="Last name" required error={errors.last_name?.message} {...register('last_name')} />
        </div>

        <PhoneInput
          id="phone_number"
          label="Phone number"
          required
          country={phoneCountry}
          nationalNumber={phoneNational}
          onCountryChange={setPhoneCountry}
          onNationalNumberChange={(value) => {
            setPhoneNational(value);
            if (phoneError) setPhoneError(null);
          }}
          error={phoneError ?? undefined}
        />

        <Input
          id="university_id"
          label="University ID"
          required
          error={errors.university_id?.message}
          {...register('university_id')}
        />

        <Input
          id="password"
          type="password"
          label="Password"
          required
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          id="confirmPassword"
          type="password"
          label="Confirm password"
          required
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>

        <Link to="/login" className="text-brand text-center text-sm font-semibold hover:underline">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
