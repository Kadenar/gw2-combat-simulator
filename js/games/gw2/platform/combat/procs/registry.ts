import { canonicalTime, timeKey } from '#kernel/core/clock.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { projectRecharge, type RechargeProgress } from '#gw2/platform/combat/recharge.js';

/** Per-run proc deadlines shared by traits, sigils, relics, and food; observations receive detached copies. */
export interface ProcRegistry {
  setDeadline(key: SkillId, at: number): void;
  snapshot(): Readonly<Record<string, number>>;
  /** Unarmed owners are ready at zero. */
  deadline(key: SkillId): number;
  /** Claims the profile's cooldown policy; summon recharges require their actual companion incarnation. */
  claim(profileId: SkillId, key?: SkillId, at?: number, companionId?: string): boolean;
  claimCooldown(key: SkillId, at: number, duration: number): boolean;
  reset(key: SkillId): void;
}

/** One registry per simulation owns proc deadlines; profile IDs and equipment namespaces isolate unrelated claims. */
export function createProcRegistry(context: () => Gw2ResolverRuntime & { readonly time?: number }): ProcRegistry {
  const readyAt: Record<string, number> = Object.create(null);
  const recharges = new Map<string, { skill: Skill; progress: RechargeProgress }>();
  // Share the same recharge intervals as cast skills, including later received summon boons and Chronomancer's rate.
  const deadline = (key: SkillId): number => {
    const recharge = recharges.get(String(key));
    if (recharge) {
      const { skill, progress } = recharge;
      readyAt[key] = canonicalTime(
        projectRecharge(
          progress,
          context().query.timeline.rechargeIntervals(skill, progress.startedAt, Infinity, progress.companionId)
        )
      );
    }

    return readyAt[key] ?? 0;
  };

  return {
    /** Sampled proc commits use the same owner; observations receive a detached deadline record. */
    setDeadline(key: SkillId, at: number): void {
      if (typeof at !== 'number' || Number.isNaN(at)) throw new TypeError('Proc cooldown readyAt must be a number.');
      recharges.delete(String(key));
      readyAt[key] = at;
    },
    snapshot: (): Readonly<Record<string, number>> => {
      for (const key of recharges.keys()) deadline(key);
      return { ...readyAt };
    },
    /** Unarmed owners are ready at zero; callers with mechanic-specific boundary rules can inspect the deadline. */
    deadline,
    claim(profileId: SkillId, key: SkillId = profileId, at = context().time, companionId?: string): boolean {
      const runtime = context();
      if (at === undefined) throw new TypeError('Resolver proc claims require an event time.');
      const profile = requireBalanceProfileFromContext(runtime, profileId);
      const policy = profile.cooldownPolicy ?? 'internal';
      if (!['internal', 'playerRecharge', 'summonRecharge'].includes(policy))
        throw new TypeError(`Invalid proc cooldown policy for ${profileId}.`);
      if (!isInternalCooldownReady(at, deadline(key))) return false;
      if (policy !== 'internal') {
        if (profile.internalCooldown != null)
          throw new TypeError(`Recharging proc ${profileId} must author cooldown, not internalCooldown.`);
        if (policy === 'summonRecharge' && !companionId)
          throw new TypeError(`Summon proc ${profileId} requires a companion identity.`);
        const work = balanceProfileNumber(profile, 'cooldown');
        if (!Number.isFinite(work) || work < 0)
          throw new TypeError('Proc recharge work must be a finite non-negative number.');
        const skill: Skill = {
          id: profileId,
          name: profile.name,
          rechargeBuffAudience: policy === 'summonRecharge' ? 'summon' : 'self'
        };
        const progress = { startedAt: at, work, ...(policy === 'summonRecharge' ? { companionId } : {}) };
        const projected = canonicalTime(
          projectRecharge(progress, runtime.query.timeline.rechargeIntervals(skill, at, Infinity, progress.companionId))
        );
        // Reserve before emitting children; reproject summon work when later boon applications become known.
        recharges.set(String(key), { skill, progress });
        readyAt[key] = projected;
        return true;
      }

      const claimed = tryConsumeProcCooldown(readyAt, key, at, balanceProfileNumber(profile, 'internalCooldown'));
      if (claimed) recharges.delete(String(key));
      return claimed;
    },
    // Scoped owners and non-ICD profile fields use the same deadline validation and exclusive boundary.
    claimCooldown(key: SkillId, at: number, duration: number): boolean {
      deadline(key);
      const claimed = tryConsumeProcCooldown(readyAt, key, at, duration);
      if (claimed) recharges.delete(String(key));
      return claimed;
    },
    reset(key: SkillId): void {
      recharges.delete(String(key));
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
