import { isInternalCooldownReady, timeKey } from '#kernel/core/clock.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

/** One registry per simulation owns trait deadlines; profile IDs isolate unrelated procs and patches retune claims. */
export function createProcRegistry(context: () => Gw2Runtime) {
  const readyAt: Record<string, number> = Object.create(null);
  return {
    /** Live deadlines also support mechanic-owned resets and reconstruction without another private trait map. */
    readyAt,
    claim(profileId: SkillId, key: SkillId = profileId): boolean {
      const runtime = context();
      return tryConsumeProcCooldown(
        readyAt,
        key,
        runtime.time,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'internalCooldown')
      );
    },
    reset(key: SkillId): void {
      delete readyAt[key];
    }
  };
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
  // Keep caller arithmetic unchanged; the clock predicate canonicalizes comparisons.
  // Zero at time zero remains unarmed, so a zero-duration claim is not a deduplication gate.
  readyAtByKey[key] = deadline;
  return true;
}
