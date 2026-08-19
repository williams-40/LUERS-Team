import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { updateMe } from '../lib/auth-api';
import type { ApiError } from '../lib/api-client';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';

const profileSchema = z.object({
  first_name: z.string().max(150).optional().or(z.literal('')),
  last_name: z.string().max(150).optional().or(z.literal('')),
  phone_number: z.string().max(15).optional().or(z.literal('')),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

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
        <Input id="first_name" label="First name" error={errors.first_name?.message} {...register('first_name')} />
        <Input id="last_name" label="Last name" error={errors.last_name?.message} {...register('last_name')} />
      </div>

      <Input
        id="phone_number"
        type="tel"
        label="Phone number"
        error={errors.phone_number?.message}
        {...register('phone_number')}
      />

      <Input
        id="email"
        type="email"
        label="Email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

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

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">My profile</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Signed in as {user ? user.role.label : '…'}.
      </p>

      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Profile details</h2>
        <Card>
          <ProfileForm />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Change password</h2>
        <Card>
          <ChangePasswordForm />
        </Card>
      </section>
    </div>
  );
}
