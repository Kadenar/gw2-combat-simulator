import { canonicalTime } from '#kernel/core/clock.js';
/**
 * Resolver observation-window policy. Normalizes the caller-owned policy
 * (`rotation`, `tail`, or `absolute`) and, once the rotation timeline is known,
 * resolves the concrete end time over which damage and effects are measured.
 */

export type ObservationPolicy =
  | { readonly kind: 'rotation' }
  | { readonly kind: 'tail'; readonly durationMs: number }
  | { readonly kind: 'absolute'; readonly endTimeMs: number };

/** Validates and freezes the caller-owned resolver observation policy. */
export function normalizeObservationPolicy(policy?: ObservationPolicy | null): ObservationPolicy {
  if (policy == null) return Object.freeze({ kind: 'rotation' });
  if (typeof policy !== 'object' || Array.isArray(policy)) {
    throw new TypeError('Observation policy must be an object.');
  }

  if (policy.kind === 'rotation') {
    return Object.freeze({ kind: 'rotation' });
  }

  if (policy.kind === 'tail') {
    const durationMs = Number(policy.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new TypeError('Observation tail durationMs must be a non-negative finite number.');
    }

    return Object.freeze({ kind: 'tail', durationMs });
  }

  if (policy.kind === 'absolute') {
    const endTimeMs = Number(policy.endTimeMs);
    if (!Number.isFinite(endTimeMs) || endTimeMs < 0) {
      throw new TypeError('Absolute observation endTimeMs must be a non-negative finite number.');
    }

    return Object.freeze({ kind: 'absolute', endTimeMs });
  }

  throw new TypeError(`Unknown observation policy kind "${String((policy as { readonly kind?: unknown }).kind)}".`);
}

/** Resolves a normalized policy after the entered command timeline is known. */
export function observationEndTime(policy: ObservationPolicy, rotationEndTime: number): number {
  const normalizedRotationEnd = Number(rotationEndTime);
  if (!Number.isFinite(normalizedRotationEnd) || normalizedRotationEnd < 0) {
    throw new TypeError('Rotation end time must be a non-negative finite number.');
  }

  // Compare canonical instants so observation cannot extend an absolute horizon through a tolerance allowance.
  const rotationEnd = canonicalTime(normalizedRotationEnd);
  if (policy.kind === 'rotation') return rotationEnd;
  if (policy.kind === 'tail') {
    return canonicalTime(rotationEnd + policy.durationMs / 1000);
  }

  const absoluteEnd = canonicalTime(policy.endTimeMs / 1000);
  if (absoluteEnd < rotationEnd) {
    throw new RangeError('Absolute observation endTimeMs cannot precede rotation end.');
  }

  return absoluteEnd;
}
