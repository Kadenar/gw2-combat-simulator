/** The owner stores the next value before reacting to a completed threshold. */
export interface CounterStep {
  readonly value: number;
  readonly reached: boolean;
}

/** Accumulates accepted progress independently of reward eligibility; the owner can check or reset it later. */
export function addCounterProgress(value: number, increment: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(increment))
    throw new RangeError('Counter values and increments must be finite.');
  const advanced = value + increment;
  if (!Number.isFinite(advanced)) throw new RangeError('Counter progress overflowed.');
  return advanced;
}

/**
 * Adds accepted progress, then retains it, caps it, or resets it on reaching the threshold.
 * Owners decide eligibility, disabled thresholds and lifetimes, and store the result before emitting rewards.
 */
export function advanceCounter(
  value: number,
  increment: number,
  threshold: number,
  onThreshold: 'retain' | 'cap' | 'reset'
): CounterStep {
  if (!Number.isFinite(threshold)) throw new RangeError('Counter thresholds must be finite.');
  if (!['retain', 'cap', 'reset'].includes(onThreshold))
    throw new TypeError('Counter threshold operation must be retain, cap or reset.');

  const advanced = addCounterProgress(value, increment);
  const reached = advanced >= threshold;
  const next =
    onThreshold === 'cap' ? Math.min(advanced, threshold) : reached && onThreshold === 'reset' ? 0 : advanced;
  if (!Number.isFinite(next)) throw new RangeError('Counter progress overflowed.');
  return { value: next, reached };
}

/** Retains cumulative progress and selects exact multiples of a period; a zero period never selects a reward. */
export function advanceCyclicCounter(value: number, increment: number, period: number): CounterStep {
  const progress = advanceCounter(value, increment, period, 'retain');
  return { value: progress.value, reached: progress.value % period === 0 };
}
