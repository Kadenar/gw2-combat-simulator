import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

/** One recipient's finite grant, consumed and expired directly by its owning mechanic. */
export interface ChargeGrant {
  charges: number;
  expiresAt: number;
  readyAt?: number;
}

export interface ChargePool {
  grants: Record<string, ChargeGrant[]>;
}

/** Appends an independently expiring recipient grant, capping only new charges without refreshing earlier expiry. */
export function grantChargePool(
  pool: ChargePool,
  recipient: string,
  at: number,
  charges: number,
  duration: number,
  cap = Infinity
): void {
  const grants = activeChargeGrants(pool.grants[recipient] ?? [], at);
  pool.grants[recipient] = grants;
  const added = Math.max(0, Math.min(charges, cap - grants.reduce((sum, grant) => sum + grant.charges, 0)));

  if (!added) return;

  const grant = grantCharges(added, at + duration);
  pool.grants[recipient] = activeChargeGrants([...grants, grant], at);
}

/** Creates a replacement or refresh-all grant; refresh preserves the ICD only while the prior grant is live. */
export function grantCharges(charges: number, expiresAt: number, previous?: ChargeGrant, at = 0): ChargeGrant {
  if (!Number.isFinite(charges) || charges < 0 || !Number.isFinite(expiresAt)) {
    throw new TypeError('Charge grants require non-negative finite charges and a finite expiry.');
  }

  // Resource deadlines and refresh eligibility share the event clock's exact expiry boundary.
  const live = previous && activeChargeCount(previous, at) > 0;
  return {
    charges: charges + (live ? previous.charges : 0),
    expiresAt: canonicalTime(expiresAt),
    readyAt: live ? (previous.readyAt ?? 0) : 0
  };
}

/** Reads live entitlement without pruning it, including windows claimed against a historical cast start. */
export function activeChargeCount(
  grant: Readonly<ChargeGrant> | undefined,
  at: number,
  inclusiveExpiry = false
): number {
  if (!grant || grant.charges <= 0) return 0;

  const time = timeKey(at);
  const expiry = timeKey(grant.expiresAt);
  return (inclusiveExpiry ? time <= expiry : time < expiry) ? grant.charges : 0;
}

/** Consumes only the selected recipient's grant, preserving each mechanic's explicit expiry boundary and ICD. */
export function consumeCharge(
  grant: ChargeGrant | undefined,
  at: number,
  cooldown = 0,
  inclusiveExpiry = false
): boolean {
  if (
    !grant ||
    activeChargeCount(grant, at, inclusiveExpiry) === 0 ||
    (cooldown > 0 && !isInternalCooldownReady(at, grant.readyAt ?? 0))
  )
    return false;

  grant.charges -= 1;

  if (cooldown > 0) grant.readyAt = canonicalTime(at + cooldown);

  return true;
}

/** Expiry records cannot clear a refreshed grant whose deadline is later than the old event. */
export function expireCharges(grant: ChargeGrant, at: number, inclusiveExpiry = false): void {
  const time = timeKey(at);
  const expiry = timeKey(grant.expiresAt);

  if (inclusiveExpiry ? time > expiry : time >= expiry) grant.charges = 0;
}

/** Filters live batches, defaulting to earliest expiry while allowing owners to retain insertion order. */
export function activeChargeGrants<T extends ChargeGrant>(
  grants: readonly T[],
  at: number,
  order: 'earliest-expiry' | 'insertion' = 'earliest-expiry'
): T[] {
  const active = grants.filter((grant) => activeChargeCount(grant, at) > 0);
  return order === 'insertion' ? active : active.sort((a, b) => timeKey(a.expiresAt) - timeKey(b.expiresAt));
}

/** Appends a separate batch without refreshing survivors, retaining the owner's explicit consumption order. */
export function appendChargeGrant<T extends ChargeGrant>(
  grants: readonly T[],
  grant: T,
  at: number,
  order: 'earliest-expiry' | 'insertion'
): T[] {
  return activeChargeGrants([...grants, grant], at, order);
}

/**
 * Spends the first eligible live batch in its retained order, removes it when exhausted, and returns it so the owner
 * can attribute the spend to that batch's own grant.
 */
export function consumeChargeBatch<T extends ChargeGrant>(
  grants: T[],
  at: number,
  eligible: (grant: T) => boolean = () => true,
  inclusiveExpiry = false
): T | undefined {
  const index = grants.findIndex((grant) => eligible(grant) && activeChargeCount(grant, at, inclusiveExpiry) > 0);

  if (index < 0) return;

  // Registered consumers retain this batch reference and must observe its live charge count through exhaustion.
  const grant = grants[index];

  if (!consumeCharge(grant, at, 0, inclusiveExpiry)) return;

  if (grant.charges === 0) grants.splice(index, 1);

  return grant;
}
