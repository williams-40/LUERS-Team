import { createReport } from './reports-api';
import type { ApiError } from './api-client';
import { getQueuedReports, removeQueuedReport, updateQueuedReport } from './offline-queue';

export interface FlushResult {
  synced: number;
  remaining: number;
}

// Guards against overlapping flushes triggered by the online event, the
// polling interval, and a manual "Retry now" click landing close together.
let flushing = false;

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) {
    return { synced: 0, remaining: (await getQueuedReports()).length };
  }
  flushing = true;

  try {
    const queued = await getQueuedReports();
    let synced = 0;

    for (const item of queued) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await createReport(item.payload);
        // eslint-disable-next-line no-await-in-loop
        await removeQueuedReport(item.id);
        synced += 1;
      } catch (err) {
        const apiError = err as ApiError;
        if (apiError.status === null) {
          // Still offline — the rest of the queue will fail the same way right now.
          break;
        }
        // Server genuinely rejected it — keep it queued (so it's not silently
        // lost) but record why instead of retrying it forever unexplained.
        // eslint-disable-next-line no-await-in-loop
        await updateQueuedReport(item.id, {
          retryCount: item.retryCount + 1,
          lastError: apiError.detail,
        });
      }
    }

    const remaining = (await getQueuedReports()).length;
    return { synced, remaining };
  } finally {
    flushing = false;
  }
}
