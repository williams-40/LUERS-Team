import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders as a labeled dialog', () => {
    render(
      <Modal title="Confirm" onClose={vi.fn()}>
        <button type="button">Action</button>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls onClose on Escape when dismissible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Confirm" onClose={onClose}>
        <button type="button">Action</button>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores Escape when not dismissible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Confirm" onClose={onClose} dismissible={false}>
        <button type="button">Action</button>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cycles Tab from the last focusable element back to the first', async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Confirm" onClose={vi.fn()}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );
    screen.getByRole('button', { name: 'Last' }).focus();

    await user.keyboard('{Tab}');

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('cycles Shift+Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Confirm" onClose={vi.fn()}>
        <button type="button">First</button>
      </Modal>,
    );
    screen.getByRole('button', { name: 'Close' }).focus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });
});
