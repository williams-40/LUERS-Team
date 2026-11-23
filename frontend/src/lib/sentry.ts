import * as Sentry from '@sentry/react';

/**
 * No-op unless VITE_SENTRY_DSN is set — matches how Twilio/Mailtrap already
 * degrade gracefully on the backend without their own credentials. Call
 * once, before the first render.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
