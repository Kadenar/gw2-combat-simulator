import { canonicalTime, timeKey } from '#kernel/core/clock.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Per-run proc deadlines shared by traits, sigils, relics, and food; observations receive detached copies. */
export interface ProcRegistry {
  setDeadline(key: SkillId, at: number): void;
  snapshot(): Readonly<Record<string, number>>;
  /** Unarmed owners are ready at zero. */
  deadline(key: SkillId): number;
  /** Claims a balance profile's internal cooldown, keyed by the profile unless a scoped key is given. */
  claim(profileId: SkillId, key?: SkillId, at?: number): boolean;
  claimCooldown(key: SkillId, at: number, duration: number): boolean;
  reset(key: SkillId): void;
}

/** One registry per simulation owns proc deadlines; profile IDs and equipment namespaces isolate unrelated claims. */
export function createProcRegistry(context: () => Gw2ResolverRuntime & { readonly time?: number }): ProcRegistry {
  const readyAt: Record<string, number> = Object.create(null);
  return {
    /** Sampled proc commits use the same owner; observations receive a detached deadline record. */
    setDeadline(key: SkillId, at: number): void {
      if (typeof at !== 'number' || Number.isNaN(at)) throw new TypeError('Proc cooldown readyAt must be a number.');
      readyAt[key] = at;
    },
    snapshot: (): Readonly<Record<string, number>> => ({ ...readyAt }),
    /** Unarmed owners are ready at zero; callers with mechanic-specific boundary rules can inspect the deadline. */
    deadline(key: SkillId): number {
      return readyAt[key] ?? 0;
    },
    claim(profileId: SkillId, key: SkillId = profileId, at = context().time): boolean {
      const runtime = context();
      if (at === undefined) throw new TypeError('Resolver proc claims require an event time.');
      return tryConsumeProcCooldown(
        readyAt,
        key,
        at,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'internalCooldown')
      );
    },
    // Scoped owners and non-ICD profile fields use the same deadline validation and exclusive boundary.
    claimCooldown(key: SkillId, at: number, duration: number): boolean {
      return tryConsumeProcCooldown(readyAt, key, at, duration);
    },
    reset(key: SkillId): void {
      delete readyAt[key];
    }
  };
}

/**
 * Internal cooldowns remain active through their recorded boundary timestamp.
 * A proc at exactly readyAt is blocked; only a later timestamp may trigger it.
 */
export function isInternalCooldownReady(at: number, readyAt = 0): boolean {
  const triggerAt = canonicalTime(at);
  // Equipment also uses infinite deadlines as unarmed/permanently blocked sentinels.
  const blockedThrough = Number.isFinite(readyAt) ? canonicalTime(readyAt) : readyAt;
  // Existing state models use 0 to mean that the ICD has never been armed.
  return blockedThrough === 0 ? triggerAt >= 0 : triggerAt > blockedThrough;
}

/** Claims a caller-owned ICD after eligibility checks, before effects can trigger another reaction. */
export function tryConsumeProcCooldown(
  readyAtByKey: Record<string, number>,
  key: string | number,
  at: number,
  duration: number
): boolean {
  const readyAt = readyAtByKey[key] ?? 0;
  if (typeof readyAt !== 'number' || Number.isNaN(readyAt)) {
    throw new TypeError('Proc cooldown readyAt must be a number.');
  }

  if (!isInternalCooldownReady(at, readyAt)) return false;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new TypeError('Proc cooldown duration must be a finite non-negative number.');
  }

  const deadline = at + duration;
  timeKey(deadline);
  // Keep caller arithmetic unchanged; the proc predicate canonicalizes comparisons.
  // Zero at time zero remains unarmed, so a zero-duration claim is not a deduplication gate.
  readyAtByKey[key] = deadline;
  return true;
}
