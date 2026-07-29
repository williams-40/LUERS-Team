import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  staff: 'Staff',
  security: 'Security Officer',
  ict_admin: 'ICT Admin',
  management: 'Management',
  system_admin: 'System Admin',
};

/** Authenticated landing stub — replaced by role-specific dashboards in later phases. */
export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Welcome{user ? `, ${user.username}` : ''}</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        Signed in as {user ? (ROLE_LABELS[user.role] ?? user.role) : '…'}. Report submission and triage views
        land in later phases.
      </p>
      <Button variant="secondary" onClick={logout}>
        Sign out
      </Button>
    </div>
  );
}
