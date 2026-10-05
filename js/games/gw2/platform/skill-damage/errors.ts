import type { DamageCalculationStatus } from '#gw2/platform/skill-damage/types.js';

/** A failed calculation carries a product status instead of an activation denial. */
export class DamageCalculationError extends Error {
  constructor(
    readonly status: Extract<DamageCalculationStatus, 'missing-input' | 'unsupported' | 'failed'>,
    message: string
  ) {
    super(message);
  }
}
