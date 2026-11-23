import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import { useAuth } from '../hooks/useAuth';

export function ChangePasswordRequiredPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleChanged() {
    // Refetch /auth/me/ so `must_change_password` reflects false — RequireAuth
    // reads it fresh on the next render and stops redirecting here.
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    navigate('/', { replace: true });
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <h1 className="mb-1 text-2xl">Set a new password</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Your account was created with a temporary password. Enter it below along with your new
        password to continue.
      </p>
      <ChangePasswordForm onSuccess={handleChanged} />
      <button
        type="button"
        onClick={() => void logout()}
        className="text-ink-secondary hover:text-ink mt-6 text-xs underline"
      >
        Sign out
      </button>
    </div>
  );
}
