import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { consumeBatch, createBatch, refreshBatch, type Batch } from '#kernel/resources/batch.js';

/** One recipient's finite grant, consumed and expired directly by its owning mechanic. */
export interface ChargeGrant extends Batch {
  readyAt?: number;
}

/** Creates an independent grant with a canonical deadline and no inherited cooldown. */
export function createChargeGrant(charges: number, expiresAt: number): ChargeGrant {
  if (!Number.isFinite(expiresAt)) throw new TypeError('Charge grants require a finite expiry.');

  return { ...createBatch(charges, expiresAt), readyAt: 0 };
}

/** Returns a new grant, retaining charges and cooldown only when the previous grant is still live. */
export function refreshChargeGrant(
  previous: Readonly<ChargeGrant> | undefined,
  charges: number,
  expiresAt: number,
  at: number
): ChargeGrant {
  if (!Number.isFinite(expiresAt)) throw new TypeError('Charge grants require a finite expiry.');

  const { batch, refreshed } = refreshBatch(previous, charges, { at, expiresAt });
  return { ...batch, readyAt: refreshed ? (previous?.readyAt ?? 0) : 0 };
}

/** Consumes only the selected recipient's grant, preserving each mechanic's ICD. */
export function consumeCharge(grant: ChargeGrant | undefined, at: number, cooldown = 0): boolean {
  if (!grant || (cooldown > 0 && !isInternalCooldownReady(at, grant.readyAt ?? 0))) return false;

  if (!consumeBatch(grant, 1, at)) return false;

  if (cooldown > 0) grant.readyAt = canonicalTime(at + cooldown);

  return true;
}
