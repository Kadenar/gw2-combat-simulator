import { projectRecharge, type RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  balanceProfileNumber,
  requireBalanceProfile,
  type BalanceProfileSource
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

/** Proc deadlines read only the live clock, selected balance data, and received recharge rates. */
export interface ProcRegistryContext {
  readonly time?: number;
  readonly helpers: BalanceProfileSource;
  readonly query: {
    readonly timeline: {
      rechargeIntervals(skill: Skill, start: number, end: number, companionId?: string): Iterable<RateInterval>;
    };
  };
}

/** Per-run proc deadlines shared by traits, sigils, relics, and food; callers query only their owned keys. */
export interface ProcRegistry {
  setDeadline(key: SkillId, at: number): void;
  /** Unarmed owners are ready at zero. */
  deadline(key: SkillId): number;
  /** Claims the profile's cooldown policy; summon recharges require their actual companion incarnation. */
  claim(profileId: SkillId, key?: SkillId, at?: number, companionId?: string): boolean;
  claimCooldown(key: SkillId, at: number, duration: number): boolean;
}

/** Fixed proc deadlines and summon recharge work are mutually exclusive authorities for a key. */
type ProcTimer = { kind: 'fixed'; readyAt: number } | { kind: 'work'; skill: Skill; progress: RechargeProgress };

/** One registry per simulation owns proc deadlines; profile IDs and equipment namespaces isolate unrelated claims. */
export function createProcRegistry(context: () => ProcRegistryContext): ProcRegistry {
  const timers = new Map<string, ProcTimer>();
  // Read live received boons without storing a second deadline alongside the captured companion's work.
  const project = (timer: ProcTimer): number => {
    if (timer.kind === 'fixed') return timer.readyAt;

    const { skill, progress } = timer;
    return canonicalTime(
      projectRecharge(
        progress,
        context().query.timeline.rechargeIntervals(skill, progress.workAnchorAt, Infinity, progress.companionId)
      )
    );
  };

  const deadline = (key: SkillId): number => {
    const timer = timers.get(String(key));
    return timer ? project(timer) : 0;
  };

  // Eligible claims validate completely before replacing work or fixed deadlines, then reserve before child effects.
  const reserveCooldown = (key: SkillId, at: number, duration: number): boolean => {
    if (!Number.isFinite(duration) || duration < 0)
      throw new TypeError('Proc cooldown duration must be a finite non-negative number.');

    const readyAt = at + duration;
    timeKey(readyAt);
    // Preserve caller arithmetic; comparisons canonicalize, and zero at time zero remains unarmed.
    timers.set(String(key), { kind: 'fixed', readyAt });
    return true;
  };

  return {
    /** Explicit deadlines replace any recharge work previously owned by the same key. */
    setDeadline(key: SkillId, at: number): void {
      if (typeof at !== 'number' || Number.isNaN(at)) throw new TypeError('Proc cooldown readyAt must be a number.');

      timers.set(String(key), { kind: 'fixed', readyAt: at });
    },
    /** Unarmed owners are ready at zero; callers with mechanic-specific boundary rules can inspect the deadline. */
    deadline,
    claim(profileId: SkillId, key: SkillId = profileId, at = context().time, companionId?: string): boolean {
      const runtime = context();

      if (at === undefined) throw new TypeError('Resolver proc claims require an event time.');

      const profile = requireBalanceProfile(runtime.helpers, profileId);
      const policy = profile.cooldownPolicy ?? 'internal';

      if (!['internal', 'summonRecharge'].includes(policy))
        throw new TypeError(`Invalid proc cooldown policy for ${profileId}.`);

      if (!isInternalCooldownReady(at, deadline(key))) return false;

      if (policy === 'summonRecharge') {
        if (profile.internalCooldown != null)
          throw new TypeError(`Recharging proc ${profileId} must author cooldown, not internalCooldown.`);

        if (!companionId) throw new TypeError(`Summon proc ${profileId} requires a companion identity.`);

        const work = balanceProfileNumber(profile, 'cooldown');

        if (!Number.isFinite(work) || work < 0)
          throw new TypeError('Proc recharge work must be a finite non-negative number.');

        const skill: Skill = {
          id: profileId,
          name: profile.name,
          rechargeBuffAudience: RECIPIENT.SUMMONS
        };
        const timer: ProcTimer = { kind: 'work', skill, progress: { workAnchorAt: at, work, companionId } };
        // Validate projection before committing; subsequent reads incorporate later received-boon grants.
        project(timer);
        timers.set(String(key), timer);
        return true;
      }

      return reserveCooldown(key, at, balanceProfileNumber(profile, 'internalCooldown'));
    },
    // Scoped owners and non-ICD profile fields use the same deadline validation and exclusive boundary.
    claimCooldown(key: SkillId, at: number, duration: number): boolean {
      if (!isInternalCooldownReady(at, deadline(key))) return false;

      return reserveCooldown(key, at, duration);
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
