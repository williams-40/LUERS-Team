import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';
import { cn } from '../../lib/utils';

function initialsFor(firstName: string, lastName: string, username: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (initials || username.slice(0, 2)).toUpperCase();
}

/**
 * Absorbs what used to be scattered across DashboardPage's "Sign out" ghost
 * button and ProfilePage's buried ThemeToggle — one place for account-level
 * controls, per the brief's own "don't duplicate theme controls" rule.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = initialsFor(user.first_name, user.last_name, user.username);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Account menu"
        aria-expanded={open}
        className="bg-brand/12 text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="bg-surface-2 absolute top-full right-0 z-50 mt-2 w-60 rounded-xl border border-ink/10 p-2 shadow-lg"
        >
          <div className="mb-1 px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{user.username}</p>
            <p className="text-ink-muted truncate text-[12.5px]">{user.role.label}</p>
          </div>

          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover:bg-ink/6 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
          >
            <UserIcon className="h-4 w-4" aria-hidden />
            My profile
          </Link>

          <div className="my-1.5 border-t border-ink/10" />

          <div className="px-2.5 py-1.5">
            <p className="text-ink-muted mb-1.5 text-[11px] font-semibold tracking-wide uppercase">Theme</p>
            <ThemeToggle />
          </div>

          <div className="my-1.5 border-t border-ink/10" />

          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className={cn(
              'hover:bg-status-critical/8 text-status-critical flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm',
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
