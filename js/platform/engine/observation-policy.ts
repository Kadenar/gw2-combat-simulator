/**
 * Resolver observation-window policy. Normalizes the caller-owned policy
 * (`rotation`, `tail`, or `absolute`) and, once the rotation timeline is known,
 * resolves the concrete end time over which damage and effects are measured.
 */
import { EPSILON } from './clock.js';
import type { NormalizedObservationPolicy, ObservationPolicy } from './types.js';

/** Validates and freezes the caller-owned resolver observation policy. */
export function normalizeObservationPolicy(
  policy: ObservationPolicy | null | undefined = undefined
): NormalizedObservationPolicy {
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
export function observationEndTime(policy: NormalizedObservationPolicy, rotationEndTime: number): number {
  const normalizedRotationEnd = Number(rotationEndTime);
  if (!Number.isFinite(normalizedRotationEnd) || normalizedRotationEnd < 0) {
    throw new TypeError('Rotation end time must be a non-negative finite number.');
  }

  if (policy.kind === 'rotation') return normalizedRotationEnd;
  if (policy.kind === 'tail') {
    return normalizedRotationEnd + policy.durationMs / 1000;
  }

  const absoluteEnd = policy.endTimeMs / 1000;
  if (absoluteEnd < normalizedRotationEnd - EPSILON) {
    throw new RangeError('Absolute observation endTimeMs cannot precede rotation end.');
  }

  return Math.max(normalizedRotationEnd, absoluteEnd);
}
