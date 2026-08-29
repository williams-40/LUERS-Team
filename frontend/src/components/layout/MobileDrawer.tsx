import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Logo } from './Logo';
import { NavList } from './NavList';

/** Mobile nav drawer — the small-screen equivalent of Sidebar, not a shrunk copy of it. */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex md:hidden">
      <div className="bg-ink/40 absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="bg-sidebar relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto px-3.5 py-4 shadow-lg"
      >
        <div className="mb-5 flex items-center justify-between gap-2 px-1">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <Logo className="h-8 w-auto shrink-0" />
            <span className="font-heading text-brand-ink text-sm font-bold">LUERS</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="text-ink-muted hover:text-ink shrink-0 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavList onNavigate={onClose} />
      </div>
    </div>,
    document.body,
  );
}
