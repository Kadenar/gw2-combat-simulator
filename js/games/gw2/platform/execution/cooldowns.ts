import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { clamp } from '#kernel/core/numeric.js';
import { projectRecharge, type RechargeProgress } from '#gw2/platform/execution/recharge.js';
/**
 * Shared cooldown and ammo-charge recharge state machine. Owns the common
 * between-cast lockout and charge bookkeeping (recharge timers, charge
 * depletion, recharge reduction) so professions only override maximum ammo and
 * recharge duration instead of reimplementing the mechanics.
 */
import type { AmmoState, CooldownController, RechargeCheckpoint } from '#gw2/platform/execution/cooldown-contracts.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

interface CooldownControllerOptions {
  readonly clock: { readonly time: number };
  readonly rechargeDuration: (skill: Skill, at: number) => number;
  readonly rechargeIntervals?: (skill: Skill, start: number, end: number) => Iterable<RateInterval>;
  readonly skillFor?: (id: SkillId) => Skill | undefined;
  readonly maximumAmmo?: (skill: Skill) => number;
}

/**
 * Owns common cooldown and ammo recharge bookkeeping. Professions may override
 * maximum ammo and recharge calculation without duplicating the state machine.
 *
 */
export function createCooldownController({
  clock,
  rechargeDuration,
  rechargeIntervals = (_skill, start, end) => [{ start, end, rate: 1 }],
  skillFor = () => undefined,
  maximumAmmo = (skill) => skill.ammo || 0
}: CooldownControllerOptions): Readonly<CooldownController> {
  // Recharge stores belong exclusively to this controller; callers supply only the live clock.
  const cooldowns = new Map<SkillId, number>();
  const rechargeProgress = new Map<SkillId, RechargeProgress>();
  const ammoPools = new Map<SkillId, AmmoState>();

  // Only received summon Alacrity can change a running recharge's projected deadline.
  const hasVariableRechargeRate = (skill: Skill): boolean =>
    skill.rechargeBuffAudience === 'summon' && !skill.rechargeIgnoresAlacrity;

  if (typeof rechargeDuration !== 'function') {
    throw new TypeError('Cooldown controller requires rechargeDuration.');
  }

  const rate = (skill: Skill, at = clock.time): number => {
    for (const interval of rechargeIntervals(skill, at, Infinity)) return interval.rate;
    return 1;
  };

  // Integrate elapsed work so later boon changes never alter progress already earned.
  const remaining = (skill: Skill, progress: RechargeProgress, at: number): number => {
    let work = progress.work;
    for (const interval of rechargeIntervals(skill, progress.startedAt, Math.max(progress.startedAt, at))) {
      work -= (interval.end - interval.start) * interval.rate;
    }

    return Math.max(0, work);
  };

  const project = (skill: Skill, progress: RechargeProgress): number =>
    projectRecharge(progress, rechargeIntervals(skill, progress.startedAt, Infinity));

  const startRecharge = (skill: Skill, at: number, work = rechargeDuration(skill, at) * rate(skill, at)): number => {
    const progress = { startedAt: at, work: Math.max(0, work) };
    rechargeProgress.set(skill.id, progress);
    const readyAt = project(skill, progress);
    cooldowns.set(skill.id, readyAt);
    return readyAt;
  };

  const setReadyAt = (skillId: SkillId, readyAt: number): void => {
    rechargeProgress.delete(skillId);
    cooldowns.set(skillId, readyAt);
  };

  const clear = (skillId: SkillId): void => {
    rechargeProgress.delete(skillId);
    cooldowns.delete(skillId);
  };

  const copy = (sourceId: SkillId, targetId: SkillId): void => {
    if (sourceId === targetId) return;
    const readyAt = cooldowns.get(sourceId);
    if (readyAt == null) {
      clear(targetId);
      return;
    }

    setReadyAt(targetId, readyAt);
    const progress = rechargeProgress.get(sourceId);
    if (progress) rechargeProgress.set(targetId, { ...progress });
  };

  const syncAmmoCooldown = (skill: Skill, ammo: AmmoState, at: number): void => {
    // Only the front charge is recharging; later spends never reset its progress.
    ammo.nextRechargeAt = ammo.recharges.length ? project(skill, ammo.recharges[0]!) : null;
    // Derive availability from independent deadlines so returning a charge cannot erase a cast lockout.
    const activeLockout = ammo.lockoutReadyAt || 0;
    const readyAt = Math.max(
      gw2CooldownReadyAt(activeLockout) > at ? activeLockout : 0,
      ammo.charges === 0 ? ammo.nextRechargeAt || 0 : 0
    );
    if (gw2CooldownReadyAt(readyAt) > at) {
      cooldowns.set(skill.id, readyAt);
    } else {
      cooldowns.delete(skill.id);
    }
  };

  /**
   * Lazily initializes ammo tracking for skills that use charges.
   */
  const ensureAmmo = (skill: Skill): AmmoState | null => {
    const maximum = Math.max(0, maximumAmmo(skill) || 0);
    if (!maximum) return null;
    if (!ammoPools.has(skill.id)) {
      ammoPools.set(skill.id, {
        charges: maximum,
        maximum,
        recharges: [],
        nextRechargeAt: null
      });
    }

    return ammoPools.get(skill.id) ?? null;
  };

  /**
   * Advances ammo recharge state to a specific time and mirrors full
   * depletion into the shared cooldown map.
   */
  const refreshAmmo = (skill: Skill, at: number): AmmoState | null => {
    const ammo = ensureAmmo(skill);
    if (!ammo) return null;
    if (ammo.lockoutProgress) ammo.lockoutReadyAt = project(skill, ammo.lockoutProgress);
    // Each skill regenerates one charge at a time, including magazines spent in one activation.
    while (ammo.recharges.length) {
      const completedAt = gw2CooldownReadyAt(project(skill, ammo.recharges[0]!));
      if (completedAt > at) break;
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      ammo.recharges.shift();
      const next = ammo.recharges[0];
      if (next) next.startedAt = Math.max(next.startedAt, completedAt);
    }

    if (ammo.charges >= ammo.maximum) ammo.recharges = [];

    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /**
   * Spends one charge, queuing serial rounds behind the active recharge.
   */
  const spendAmmo = (skill: Skill, at: number, committedRechargeWork?: number): void => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.charges <= 0) return;
    ammo.charges -= 1;
    // A cast carries its selected recharge through completion; direct resource spends still query at their anchor.
    const work = Math.max(0, committedRechargeWork ?? rechargeDuration(skill, at) * rate(skill, at));
    ammo.recharges.push({ startedAt: at, work });

    syncAmmoCooldown(skill, ammo, at);
  };

  /** Restore the last queued rounds first, preserving active progress and cast lockouts. */
  const restoreAmmo = (skill: Skill, count: number, at: number): number => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo) return 0;
    // Restore only available capacity; negative requests or an already-full pool grant nothing.
    const restored = clamp(Math.floor(count || 0), 0, ammo.maximum - ammo.charges);
    if (!restored) return 0;
    ammo.charges += restored;
    ammo.recharges.splice(Math.max(0, ammo.recharges.length - restored));

    syncAmmoCooldown(skill, ammo, at);
    return restored;
  };

  /**
   * Apply a reduction once across the recharge queue, carrying excess into waiting charges.
   * Returns recovered wall time after applying the current recharge rate.
   */
  const reduceAmmoRecharge = (skill: Skill, requested: number, at: number): number => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.nextRechargeAt == null) return 0;

    let reducedWork = 0;
    let remainingReduction = requested;
    ammo.recharges = ammo.recharges.map((progress, index) => {
      // Magazine reservations may precede their recharge anchor; reductions only affect timers already running.
      if (progress.startedAt > at) return progress;
      // Waiting rounds have not earned elapsed work; only excess reduction reaches their full interval.
      const work = index === 0 ? remaining(skill, progress, at) : progress.work;
      const reduction = Math.min(remainingReduction, work);
      remainingReduction -= reduction;
      reducedWork += reduction;
      return { startedAt: index === 0 ? at : progress.startedAt, work: work - reduction };
    });
    refreshAmmo(skill, at);
    return reducedWork / rate(skill, at);
  };

  /** Applies game-adjusted recharge progress to ammo or an ordinary cooldown without passing its ready time. */
  const reduceSkillRecharge = (skill: Skill, reduction: number, at = clock.time): number => {
    const requested = Math.max(0, reduction || 0);
    if (requested <= 0) return 0;
    if (ammoPools.has(skill.id)) {
      return reduceAmmoRecharge(skill, requested, at);
    }

    const progress = rechargeProgress.get(skill.id);
    if (!progress) {
      // Explicit fixed deadlines keep their existing policy when reduced.
      const readyAt = cooldowns.get(skill.id) || 0;
      const reducedBy = clamp(requested / rate(skill, at), 0, readyAt - at);
      if (reducedBy) setReadyAt(skill.id, readyAt - reducedBy);
      return reducedBy;
    }

    const work = remaining(skill, progress, at);
    const reducedWork = Math.min(requested, work);
    if (!reducedWork) return 0;
    startRecharge(skill, at, work - reducedWork);
    return reducedWork / rate(skill, at);
  };

  /**
   * Applies base work for the short between-cast recharge independently from count recharge.
   */
  const setAmmoLockout = (skill: Skill, work: number, at = clock.time): void => {
    const ammo = ensureAmmo(skill);
    if (!ammo) return;
    const progress = { startedAt: at, work: Math.max(0, work) };
    const projected = project(skill, progress);
    const previous = ammo.lockoutProgress ? project(skill, ammo.lockoutProgress) : ammo.lockoutReadyAt || 0;
    // Extending a lockout preserves work already accrued on the longer timer.
    if (projected >= previous) ammo.lockoutProgress = progress;
    ammo.lockoutReadyAt = Math.max(previous, projected);
    syncAmmoCooldown(skill, ammo, at);
  };

  return Object.freeze({
    // Live formula queries settle only this magazine and retain their unrounded deadline comparison.
    isOnCooldown(id: SkillId, at = clock.time) {
      if (at !== clock.time) throw new RangeError('Live cooldown queries must use the current clock.');
      const skill = skillFor(id);
      if (skill && ammoPools.has(id)) refreshAmmo(skill, at);
      const progress = rechargeProgress.get(id);
      // Same-timestamp summon boon changes must be visible before the next clock refresh.
      const readyAt =
        skill && progress && hasVariableRechargeRate(skill) ? project(skill, progress) : (cooldowns.get(id) ?? 0);
      return readyAt > at;
    },
    readyAt: (id: SkillId) => cooldowns.get(id),
    hasCooldown: (id: SkillId) => cooldowns.has(id),
    readAmmo: (id: SkillId) => ammoPools.get(id),
    hasAmmo: (id: SkillId) => ammoPools.has(id),
    rechargeFor: (id: SkillId) => rechargeProgress.get(id),
    cooldownSkillIds: () => cooldowns.keys(),
    ammoSkillIds: () => ammoPools.keys(),
    retireAmmo(id: SkillId) {
      ammoPools.delete(id);
    },
    linkAmmo(sourceId: SkillId, targetId: SkillId) {
      // Alternate skill identities intentionally share one magazine and queue, rather than copying charge counts.
      const ammo = ammoPools.get(sourceId);
      if (ammo) ammoPools.set(targetId, ammo);
    },
    clearAmmoLockout(id: SkillId) {
      const ammo = ammoPools.get(id);
      if (ammo) {
        ammo.lockoutReadyAt = 0;
        delete ammo.lockoutProgress;
      }
    },
    reserveAmmo(skill: Skill, count: number, recharge: RechargeProgress) {
      const ammo = ammoPools.get(skill.id);
      if (!ammo) return 0;
      const reserved = clamp(Math.floor(count), 0, ammo.charges);
      ammo.charges -= reserved;
      for (let index = 0; index < reserved; index++) ammo.recharges.push({ ...recharge });
      // Acceptance may precede the recharge anchor; only the live clock can settle existing timers.
      if (reserved) refreshAmmo(skill, clock.time);
      return reserved;
    },
    replaceAmmoCharges(skill: Skill, maximum: number, charges: number, recharges: readonly RechargeProgress[]) {
      const ammo = ammoPools.get(skill.id);
      if (!ammo) return;
      ammo.maximum = maximum;
      ammo.charges = charges;
      ammo.recharges = recharges.map((progress) => ({ ...progress }));
      ammo.nextRechargeAt = ammo.recharges.length ? project(skill, ammo.recharges[0]!) : null;
    },
    checkpoint(
      at: number,
      preservedCooldownIds: ReadonlySet<SkillId>,
      independentCooldownId: SkillId
    ): RechargeCheckpoint {
      // Capture work without advancing clocks; only the front queued charge has earned elapsed recharge.
      return {
        remainingCooldowns: new Map(
          [...cooldowns]
            .filter(([id]) => id !== independentCooldownId && !preservedCooldownIds.has(id))
            .map(([id, ready]) => [id, ready - at])
        ),
        remainingRechargeWork: new Map(
          [...rechargeProgress].flatMap(([id, progress]) => {
            const skill = skillFor(id);
            return skill && !preservedCooldownIds.has(id) && gw2CooldownReadyAt(project(skill, progress)) > at
              ? [[id, remaining(skill, progress, at)] as const]
              : [];
          })
        ),
        ammo: new Map(
          [...ammoPools].map(([id, ammo]) => {
            const skill = skillFor(id);
            return [
              id,
              {
                charges: ammo.charges,
                maximum: ammo.maximum,
                pendingRechargeWork: ammo.recharges.map((progress, index) =>
                  index > 0 ? progress.work : remaining(skill!, progress, at)
                ),
                ...(ammo.lockoutProgress && gw2CooldownReadyAt(ammo.lockoutReadyAt ?? 0) > at && skill
                  ? { pendingLockoutWork: remaining(skill, ammo.lockoutProgress, at) }
                  : {}),
                nextRechargeRemaining: ammo.nextRechargeAt == null ? null : Math.max(0, ammo.nextRechargeAt - at),
                lockoutRemaining: Math.max(0, (ammo.lockoutReadyAt ?? 0) - at)
              }
            ];
          })
        )
      };
    },
    restoreCheckpoint(
      checkpoint: RechargeCheckpoint,
      at: number,
      preservedCooldownIds: ReadonlySet<SkillId>,
      deadlines: readonly { readonly skillId: SkillId; readonly readyAt: number }[]
    ) {
      // Restore relative work/deadlines atomically before reprojecting against the current recharge rate.
      const preservedCooldowns = [...cooldowns].filter(([id]) => preservedCooldownIds.has(id));
      const progress = [...rechargeProgress].filter(([id]) => preservedCooldownIds.has(id));
      cooldowns.clear();
      for (const [id, ready] of preservedCooldowns) cooldowns.set(id, ready);
      for (const [id, duration] of checkpoint.remainingCooldowns) if (duration > 0) cooldowns.set(id, at + duration);
      for (const deadline of deadlines) cooldowns.set(deadline.skillId, deadline.readyAt);
      rechargeProgress.clear();
      for (const [id, value] of progress) rechargeProgress.set(id, value);
      // Restored work must publish its deadline now; constant-rate timers no longer reproject during refresh.
      for (const [id, work] of checkpoint.remainingRechargeWork) {
        const restored = { startedAt: at, work };
        rechargeProgress.set(id, restored);
        const skill = skillFor(id);
        if (skill) cooldowns.set(id, project(skill, restored));
      }

      ammoPools.clear();
      for (const [id, ammo] of checkpoint.ammo)
        ammoPools.set(id, {
          charges: ammo.charges,
          maximum: ammo.maximum,
          recharges: ammo.pendingRechargeWork.map((work) => ({ startedAt: at, work })),
          ...(ammo.pendingLockoutWork == null
            ? {}
            : { lockoutProgress: { startedAt: at, work: ammo.pendingLockoutWork } }),
          nextRechargeAt: ammo.nextRechargeRemaining == null ? null : at + ammo.nextRechargeRemaining,
          lockoutReadyAt: ammo.lockoutRemaining > 0 ? at + ammo.lockoutRemaining : 0
        });
    },
    resetAll() {
      cooldowns.clear();
      rechargeProgress.clear();
      ammoPools.clear();
    },
    startRecharge,
    setReadyAt,
    clear,
    copy,
    rate,
    project,
    remaining,
    refresh(at: number) {
      // Retain completed progress for mechanic consumers while skipping constant-rate projection work.
      for (const [id, progress] of rechargeProgress) {
        const skill = skillFor(id);
        if (skill && hasVariableRechargeRate(skill)) cooldowns.set(id, project(skill, progress));
      }

      for (const id of ammoPools.keys()) {
        const skill = skillFor(id);
        if (skill) refreshAmmo(skill, at);
      }
    },
    ensureAmmo,
    reduceSkillRecharge,
    refreshAmmo,
    restoreAmmo,
    setAmmoLockout,
    spendAmmo
  });
}
