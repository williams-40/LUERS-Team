import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Must be a class component — React only supports error boundaries via
 * getDerivedStateFromError/componentDidCatch, no hook equivalent exists.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Safe no-op if lib/sentry.ts never called Sentry.init() (i.e.
    // VITE_SENTRY_DSN isn't set) — the SDK's top-level API tolerates being
    // called without an active client.
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
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

    return this.props.children;
  }
}
