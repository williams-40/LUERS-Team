import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Urgency } from '../types/domain';
import type { CreateReportInput } from '../types/domain';

const payload: CreateReportInput = {
  department: 'dept-1',
  description: 'Bike stolen outside library',
  urgency: Urgency.NORMAL,
};

let enqueueReport: typeof import('./offline-queue').enqueueReport;
let getQueuedReports: typeof import('./offline-queue').getQueuedReports;
let removeQueuedReport: typeof import('./offline-queue').removeQueuedReport;
let updateQueuedReport: typeof import('./offline-queue').updateQueuedReport;

// The module keeps its IDB connection in a module-level singleton, so a
// fresh `indexedDB` alone isn't enough isolation between tests — the module
// itself must be re-imported so that singleton is rebuilt against it.
beforeEach(async () => {
  indexedDB = new IDBFactory();
  vi.resetModules();
  ({ enqueueReport, getQueuedReports, removeQueuedReport, updateQueuedReport } = await import('./offline-queue'));
});

describe('offline-queue', () => {
  it('enqueues a report and retrieves it', async () => {
    const item = await enqueueReport(payload, false);

    expect(item.payload).toEqual(payload);
    expect(item.hadDroppedEvidence).toBe(false);
    expect(item.retryCount).toBe(0);

    const all = await getQueuedReports();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(item.id);
  });

  it('returns queued reports oldest-first', async () => {
    const first = await enqueueReport(payload, false);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await enqueueReport(payload, true);

    const all = await getQueuedReports();
    expect(all.map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it('removes a queued report', async () => {
    const item = await enqueueReport(payload, false);
    await removeQueuedReport(item.id);

    expect(await getQueuedReports()).toHaveLength(0);
  });

  it('patches a queued report in place', async () => {
    const item = await enqueueReport(payload, false);
    await updateQueuedReport(item.id, { retryCount: 2, lastError: 'boom' });

    const [updated] = await getQueuedReports();
    expect(updated.retryCount).toBe(2);
    expect(updated.lastError).toBe('boom');
    expect(updated.payload).toEqual(payload);
  });

  it('is a no-op when patching a report that no longer exists', async () => {
    await expect(updateQueuedReport('does-not-exist', { retryCount: 5 })).resolves.toBeUndefined();
    expect(await getQueuedReports()).toHaveLength(0);
  });
});
