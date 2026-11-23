import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <h1 className="mb-2 text-2xl">Page not found</h1>
      <p className="text-ink-secondary mb-4 text-sm">That page doesn't exist.</p>
      <Link to="/" className="text-brand font-semibold hover:underline">
        Back home
      </Link>
    </div>
  );
}
