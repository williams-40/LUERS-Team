import { Outlet } from 'react-router-dom';
import { Logo } from './Logo';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-surface-2 flex items-center justify-between border-b border-black/10 px-5 py-3">
        <Logo className="h-9 w-auto" />
        <span className="font-heading text-brand-ink text-sm font-bold">LUERS</span>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
