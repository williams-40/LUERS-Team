import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('renders nothing when there are no toasts', () => {
    renderWithProvider(<div />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows a success toast as a dialog popup', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Trigger message="Updated 3 reports." variant="success" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Updated 3 reports.');
  });

  it('shows an error toast as an alertdialog popup', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Trigger message="Something failed." variant="error" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Something failed.');
  });

  it('does not auto-dismiss — stays until OK is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Trigger message="Stay put" variant="info" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Stay put')).not.toBeInTheDocument();
  });

  it('queues a second toast behind the first instead of showing both at once', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Trigger message="First" variant="info" />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    // Two show() calls queue two toasts with the same message, but only
    // the head of the queue renders.
    expect(screen.getAllByText('First')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'OK' }));
    // The second, identical-message toast is still queued behind the first.
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger message="x" />)).toThrow('useToast must be used within a ToastProvider');
    consoleSpy.mockRestore();
  });
});
