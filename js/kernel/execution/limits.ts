/**
 * Shared default budget for bounded execution: queues cap work at one timestamp,
 * while runtimes cap total loop iterations. Both use this ceiling to stop runaway work.
 */
export const DEFAULT_EXECUTION_ITERATION_LIMIT = 100_000;
