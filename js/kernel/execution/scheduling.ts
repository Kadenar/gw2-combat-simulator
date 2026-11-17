/** Schedulers route named work and cancel one lifetime without exposing their queue. */

/** Reusing an id with a new generation starts a lifetime independent of its earlier work. */
export interface WorkOwner {
  readonly id: string;
  readonly generation: number;
}

export interface WorkScheduler {
  /**
   * Route work to its handler at the canonical at timestamp, with the handler's context.time equal to at.
   * Deliver periodic generation tokens unchanged. Payloads may be detached before delivery.
   */
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number): void;
  /** Cancel pending work with both this id and generation; other lifetimes remain eligible. */
  cancelOwner(owner: WorkOwner): void;
}
