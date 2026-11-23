import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Status } from '../../types/domain';
import { BulkActionToolbar } from './BulkActionToolbar';

vi.mock('../../lib/reports-api', () => ({
  fetchOfficers: vi.fn().mockResolvedValue([{ id: 'o1', username: 'officer_jane' }]),
}));

function renderToolbar(props: Partial<Parameters<typeof BulkActionToolbar>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = {
    count: 2,
    onBulkStatus: vi.fn(),
    onBulkAssign: vi.fn(),
    onClear: vi.fn(),
    busy: false,
    ...props,
  };
  render(
    <QueryClientProvider client={queryClient}>
      <BulkActionToolbar {...defaultProps} />
    </QueryClientProvider>,
  );
  return defaultProps;
}

describe('BulkActionToolbar', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <BulkActionToolbar count={0} onBulkStatus={vi.fn()} onBulkAssign={vi.fn()} onClear={vi.fn()} busy={false} />
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the selected count', () => {
    renderToolbar({ count: 5 });
    expect(screen.getByText('5 reports selected')).toBeInTheDocument();
  });

  it('singularizes the count label for exactly one', () => {
    renderToolbar({ count: 1 });
    expect(screen.getByText('1 report selected')).toBeInTheDocument();
  });

  it('calls onBulkStatus with the selected status', async () => {
    const props = renderToolbar();
    await userEvent.selectOptions(screen.getByDisplayValue('acknowledged'), Status.RESOLVED);
    await userEvent.click(screen.getByRole('button', { name: 'Apply status' }));
    expect(props.onBulkStatus).toHaveBeenCalledWith(Status.RESOLVED);
  });

  it('calls onBulkAssign with the selected officer id once an officer is chosen', async () => {
    const props = renderToolbar();
    const assignButton = await screen.findByRole('button', { name: 'Assign' });
    expect(assignButton).toBeDisabled();

    const officerSelect = await screen.findByDisplayValue('Select an officer');
    await userEvent.selectOptions(officerSelect, 'o1');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    expect(props.onBulkAssign).toHaveBeenCalledWith('o1');
  });

  it('calls onClear when the clear button is clicked', async () => {
    const props = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(props.onClear).toHaveBeenCalled();
  });

  it('disables action buttons while busy', () => {
    renderToolbar({ busy: true });
    expect(screen.getByRole('button', { name: 'Apply status' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
  });
});
