// Shared by the worker (writes) and the API's /api/health/ready (reads): one process hosts both.
export const workerState = {
  startedAt: Date.now(),
  /** Epoch ms of the last reconcile that completed, or 0 before the first. */
  lastReconcileAt: 0,
  sockets: 0,
  maxSockets: 0,
  /** True once the worker has started in this process; an API-only process never reports worker health. */
  expected: false,
};

/** Ready once the worker has reconciled at least once recently; a stuck loop shows up as stale. */
export const RECONCILE_STALE_MS = 2 * 60_000;
export const workerFresh = (now = Date.now()) => workerState.lastReconcileAt > 0 && now - workerState.lastReconcileAt < RECONCILE_STALE_MS;
