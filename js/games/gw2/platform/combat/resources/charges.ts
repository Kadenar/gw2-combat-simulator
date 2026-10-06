import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';

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

  const live = previous && previous.charges > 0 && previous.expiresAt > at;
  return {
    charges: charges + (live ? previous.charges : 0),
    expiresAt,
    readyAt: live ? (previous.readyAt ?? 0) : 0
  };
}

/** Reads live entitlement without pruning it, including windows claimed against a historical cast start. */
export function activeChargeCount(
  grant: Readonly<ChargeGrant> | undefined,
  at: number,
  inclusiveExpiry = false
): number {
  return grant && grant.charges > 0 && (inclusiveExpiry ? at <= grant.expiresAt : at < grant.expiresAt)
    ? grant.charges
    : 0;
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
  if (cooldown > 0) grant.readyAt = at + cooldown;
  return true;
}

/** Expiry records cannot clear a refreshed grant whose deadline is later than the old event. */
export function expireCharges(grant: ChargeGrant, at: number, inclusiveExpiry = false): void {
  if (inclusiveExpiry ? at > grant.expiresAt : at >= grant.expiresAt) grant.charges = 0;
}

/** Filters live batches, defaulting to earliest expiry while allowing owners to retain insertion order. */
export function activeChargeGrants<T extends ChargeGrant>(
  grants: readonly T[],
  at: number,
  order: 'earliest-expiry' | 'insertion' = 'earliest-expiry'
): T[] {
  const active = grants.filter((grant) => grant.charges > 0 && grant.expiresAt > at);
  return order === 'insertion' ? active : active.sort((a, b) => a.expiresAt - b.expiresAt);
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

/** Spends the first eligible live batch in its retained order and removes it when exhausted. */
export function consumeChargeBatch<T extends ChargeGrant>(
  grants: T[],
  at: number,
  eligible: (grant: T) => boolean = () => true
): boolean {
  const index = grants.findIndex((grant) => eligible(grant) && grant.charges > 0 && grant.expiresAt > at);
  if (index < 0) return false;
  const grant = { ...grants[index] };
  if (!consumeCharge(grant, at)) return false;
  if (grant.charges === 0) grants.splice(index, 1);
  else grants[index] = grant;
  return true;
}
