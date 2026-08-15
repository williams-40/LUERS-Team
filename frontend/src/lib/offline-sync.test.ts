import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from './api-client';
import { Urgency } from '../types/domain';
import type { QueuedReport } from './offline-queue';

const { createReport } = vi.hoisted(() => ({ createReport: vi.fn() }));
vi.mock('./reports-api', () => ({ createReport }));

const { getQueuedReports, removeQueuedReport, updateQueuedReport } = vi.hoisted(() => ({
  getQueuedReports: vi.fn(),
  removeQueuedReport: vi.fn(),
  updateQueuedReport: vi.fn(),
}));
vi.mock('./offline-queue', () => ({ getQueuedReports, removeQueuedReport, updateQueuedReport }));

const { flushQueue } = await import('./offline-sync');

function queuedItem(overrides: Partial<QueuedReport> = {}): QueuedReport {
  return {
    id: 'q1',
    payload: { department: 'dept-1', description: 'x', urgency: Urgency.NORMAL },
    hadDroppedEvidence: false,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  removeQueuedReport.mockResolvedValue(undefined);
  updateQueuedReport.mockResolvedValue(undefined);
});

describe('flushQueue', () => {
  it('syncs every queued report and removes each on success', async () => {
    const items = [queuedItem({ id: 'a' }), queuedItem({ id: 'b' })];
    getQueuedReports.mockResolvedValueOnce(items).mockResolvedValueOnce([]);
    createReport.mockResolvedValue({});

    const result = await flushQueue();

    expect(createReport).toHaveBeenCalledTimes(2);
    expect(removeQueuedReport).toHaveBeenCalledWith('a');
    expect(removeQueuedReport).toHaveBeenCalledWith('b');
    expect(result).toEqual({ synced: 2, remaining: 0 });
  });

  it('stops at the first item when still offline (status null)', async () => {
    const items = [queuedItem({ id: 'a' }), queuedItem({ id: 'b' })];
    getQueuedReports.mockResolvedValueOnce(items).mockResolvedValueOnce(items);
    const offlineError: ApiError = { status: null, detail: 'offline', fieldErrors: null };
    createReport.mockRejectedValueOnce(offlineError);

    const result = await flushQueue();

    expect(createReport).toHaveBeenCalledTimes(1);
    expect(removeQueuedReport).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, remaining: 2 });
  });

  it('keeps a server-rejected item queued and records the error instead of retrying forever', async () => {
    const items = [queuedItem({ id: 'a', retryCount: 1 })];
    getQueuedReports.mockResolvedValueOnce(items).mockResolvedValueOnce(items);
    const rejectedError: ApiError = { status: 400, detail: 'Bad description', fieldErrors: null };
    createReport.mockRejectedValueOnce(rejectedError);

    const result = await flushQueue();

    expect(removeQueuedReport).not.toHaveBeenCalled();
    expect(updateQueuedReport).toHaveBeenCalledWith('a', { retryCount: 2, lastError: 'Bad description' });
    expect(result).toEqual({ synced: 0, remaining: 1 });
  });

  it('returns immediately without re-entering when a flush is already in progress', async () => {
    let resolveFirst!: () => void;
    getQueuedReports.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () => resolve([queuedItem()]);
        }),
    );
    createReport.mockImplementation(() => new Promise(() => {}));

    void flushQueue(); // left in-flight deliberately; never awaited
    getQueuedReports.mockResolvedValueOnce([queuedItem(), queuedItem({ id: 'b' })]);
    const secondResult = await flushQueue();

    expect(secondResult).toEqual({ synced: 0, remaining: 2 });
    resolveFirst();
  });
});
