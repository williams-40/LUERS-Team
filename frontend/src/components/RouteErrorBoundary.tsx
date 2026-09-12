import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Button } from './ui/Button';

/**
 * react-router-dom's data router (createBrowserRouter) catches render
 * errors from route components itself, via each route's errorElement —
 * they never reach a React error boundary wrapped around <RouterProvider>.
 * This is that errorElement, applied to the root route so it covers every
 * child route that doesn't define its own.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-5 py-8 text-center">
      <h1 className="text-xl">Something went wrong</h1>
      <p className="text-ink-secondary text-sm">
        An unexpected error occurred. Reloading the page usually fixes this.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
