import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../lib/toast-context';

function Trigger({ message, variant }: { message: string; variant?: 'success' | 'error' | 'info' }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, variant)}>
      Trigger
    </button>
  );
}

function renderWithProvider(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Toast / ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    renderWithProvider(<div />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a success toast with role="status"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Trigger message="Updated 3 reports." variant="success" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(screen.getByRole('status')).toHaveTextContent('Updated 3 reports.');
  });

  it('shows an error toast with role="alert"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Trigger message="Something failed." variant="error" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Something failed.');
  });

  it('auto-dismisses after 5000ms', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Trigger message="Bye soon" variant="info" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses immediately when the dismiss button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Trigger message="Dismiss me" variant="info" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProvider(<Trigger message="First" variant="info" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger message="x" />)).toThrow('useToast must be used within a ToastProvider');
    consoleSpy.mockRestore();
  });
});
