import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/execution/cast-timing.js';
import { clamp } from '#kernel/core/numeric.js';
import { projectRecharge, type RechargeProgress } from '#gw2/platform/execution/recharge.js';
/**
 * Shared cooldown and ammo-charge recharge state machine. Owns the common
 * between-cast lockout and charge bookkeeping (recharge timers, charge
 * depletion, recharge reduction) so professions only override maximum ammo and
 * recharge duration instead of reimplementing the mechanics.
 */
import type { AmmoState, CooldownController, RechargeCheckpoint } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

interface CooldownControllerOptions {
  readonly state: Pick<Gw2Runtime, 'time' | 'ammo' | 'cooldowns' | 'rechargeProgress'>;
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
  state,
  rechargeDuration,
  rechargeIntervals = (_skill, start, end) => [{ start, end, rate: 1 }],
  skillFor = () => undefined,
  maximumAmmo = (skill) => skill.ammo || 0
}: CooldownControllerOptions): Readonly<CooldownController> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Headless JavaScript callers must supply all cooldown stores.
  if (!state.ammo || !state.cooldowns || !state.rechargeProgress) {
    throw new TypeError('Cooldown controller requires live runtime state.');
  }

  if (typeof rechargeDuration !== 'function') {
    throw new TypeError('Cooldown controller requires rechargeDuration.');
  }

  const rate = (skill: Skill, at = state.time): number => {
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
    state.rechargeProgress.set(skill.id, progress);
    const readyAt = project(skill, progress);
    state.cooldowns.set(skill.id, readyAt);
    return readyAt;
  };

  const setReadyAt = (skillId: SkillId, readyAt: number): void => {
    state.rechargeProgress.delete(skillId);
    state.cooldowns.set(skillId, readyAt);
  };

  const clear = (skillId: SkillId): void => {
    state.rechargeProgress.delete(skillId);
    state.cooldowns.delete(skillId);
  };

  const copy = (sourceId: SkillId, targetId: SkillId): void => {
    if (sourceId === targetId) return;
    const readyAt = state.cooldowns.get(sourceId);
    if (readyAt == null) {
      clear(targetId);
      return;
    }

    setReadyAt(targetId, readyAt);
    const progress = state.rechargeProgress.get(sourceId);
    if (progress) state.rechargeProgress.set(targetId, { ...progress });
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
      state.cooldowns.set(skill.id, readyAt);
    } else {
      state.cooldowns.delete(skill.id);
    }
  };

  /**
   * Lazily initializes ammo tracking for skills that use charges.
   */
  const ensureAmmo = (skill: Skill): AmmoState | null => {
    const maximum = Math.max(0, maximumAmmo(skill) || 0);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        recharges: [],
        nextRechargeAt: null
      });
    }

    return state.ammo.get(skill.id) ?? null;
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
  const reduceSkillRecharge = (skill: Skill, reduction: number, at = state.time): number => {
    const requested = Math.max(0, reduction || 0);
    if (requested <= 0) return 0;
    if (state.ammo.has(skill.id)) {
      return reduceAmmoRecharge(skill, requested, at);
    }

    const progress = state.rechargeProgress.get(skill.id);
    if (!progress) {
      // Explicit fixed deadlines keep their existing policy when reduced.
      const readyAt = state.cooldowns.get(skill.id) || 0;
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
  const setAmmoLockout = (skill: Skill, work: number, at = state.time): void => {
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
    readyAt: (id: SkillId) => state.cooldowns.get(id),
    hasCooldown: (id: SkillId) => state.cooldowns.has(id),
    readAmmo: (id: SkillId) => state.ammo.get(id),
    hasAmmo: (id: SkillId) => state.ammo.has(id),
    rechargeFor: (id: SkillId) => state.rechargeProgress.get(id),
    cooldownSkillIds: () => state.cooldowns.keys(),
    ammoSkillIds: () => state.ammo.keys(),
    retireAmmo(id: SkillId) {
      state.ammo.delete(id);
    },
    linkAmmo(sourceId: SkillId, targetId: SkillId) {
      // Alternate skill identities intentionally share one magazine and queue, rather than copying charge counts.
      const ammo = state.ammo.get(sourceId);
      if (ammo) state.ammo.set(targetId, ammo);
    },
    clearAmmoLockout(id: SkillId) {
      const ammo = state.ammo.get(id);
      if (ammo) {
        ammo.lockoutReadyAt = 0;
        delete ammo.lockoutProgress;
      }
    },
    reserveAmmo(skill: Skill, count: number, recharge: RechargeProgress) {
      const ammo = state.ammo.get(skill.id);
      if (!ammo) return 0;
      const reserved = clamp(Math.floor(count), 0, ammo.charges);
      ammo.charges -= reserved;
      for (let index = 0; index < reserved; index++) ammo.recharges.push({ ...recharge });
      // Acceptance may precede the recharge anchor; only the live clock can settle existing timers.
      if (reserved) refreshAmmo(skill, state.time);
      return reserved;
    },
    replaceAmmoCharges(skill: Skill, maximum: number, charges: number, recharges: readonly RechargeProgress[]) {
      const ammo = state.ammo.get(skill.id);
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
          [...state.cooldowns]
            .filter(([id]) => id !== independentCooldownId && !preservedCooldownIds.has(id))
            .map(([id, ready]) => [id, ready - at])
        ),
        remainingRechargeWork: new Map(
          [...state.rechargeProgress].flatMap(([id, progress]) => {
            const skill = skillFor(id);
            return skill && !preservedCooldownIds.has(id) && gw2CooldownReadyAt(project(skill, progress)) > at
              ? [[id, remaining(skill, progress, at)] as const]
              : [];
          })
        ),
        ammo: new Map(
          [...state.ammo].map(([id, ammo]) => {
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
      const cooldowns = [...state.cooldowns].filter(([id]) => preservedCooldownIds.has(id));
      const progress = [...state.rechargeProgress].filter(([id]) => preservedCooldownIds.has(id));
      state.cooldowns.clear();
      for (const [id, ready] of cooldowns) state.cooldowns.set(id, ready);
      for (const [id, duration] of checkpoint.remainingCooldowns)
        if (duration > 0) state.cooldowns.set(id, at + duration);
      for (const deadline of deadlines) state.cooldowns.set(deadline.skillId, deadline.readyAt);
      state.rechargeProgress.clear();
      for (const [id, value] of progress) state.rechargeProgress.set(id, value);
      for (const [id, work] of checkpoint.remainingRechargeWork)
        state.rechargeProgress.set(id, { startedAt: at, work });
      state.ammo.clear();
      for (const [id, ammo] of checkpoint.ammo)
        state.ammo.set(id, {
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
      state.cooldowns.clear();
      state.rechargeProgress.clear();
      state.ammo.clear();
    },
    startRecharge,
    setReadyAt,
    clear,
    copy,
    rate,
    project,
    remaining,
    refresh(at: number) {
      for (const [id, progress] of state.rechargeProgress) {
        const skill = skillFor(id);
        if (skill) state.cooldowns.set(id, project(skill, progress));
      }

      for (const id of state.ammo.keys()) {
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
