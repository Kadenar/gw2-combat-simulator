import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { clamp } from '#kernel/core/numeric.js';
import { projectRecharge, type RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
/**
 * Shared cooldown and ammo-charge recharge state machine. Owns the common
 * between-cast lockout and charge bookkeeping (recharge timers, charge
 * depletion, recharge reduction) so professions only override maximum ammo and
 * recharge duration instead of reimplementing the mechanics.
 */
import type { AmmoState, CooldownController } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

interface CooldownControllerOptions {
  readonly state: Pick<Gw2Runtime, 'time' | 'ammo' | 'cooldowns' | 'rechargeProgress'>;
  readonly rechargeDuration: (skill: Skill, at: number) => number;
  readonly rate?: (skill: Skill) => number;
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
  rate = () => 1,
  skillFor = () => undefined,
  maximumAmmo = (skill) => Number(skill.ammo || 0)
}: CooldownControllerOptions): Readonly<CooldownController> {
  if (!state?.ammo || !state?.cooldowns || !state?.rechargeProgress) {
    throw new TypeError('Cooldown controller requires live runtime state.');
  }

  if (typeof rechargeDuration !== 'function') {
    throw new TypeError('Cooldown controller requires rechargeDuration.');
  }

  // Permanent Alacrity turns elapsed time directly into base recharge work.
  const remaining = (skill: Skill, progress: RechargeProgress, at: number): number =>
    Math.max(0, progress.work - Math.max(0, at - progress.startedAt) * rate(skill));

  const project = (skill: Skill, progress: RechargeProgress): number => projectRecharge(progress, rate(skill));

  const startRecharge = (skill: Skill, at: number, work = rechargeDuration(skill, at) * rate(skill)): number => {
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
    // Derive availability from independent deadlines so returning a charge cannot erase a cast lockout.
    const activeLockout = Number(ammo.lockoutReadyAt || 0);
    const readyAt = Math.max(
      gw2CooldownReadyAt(activeLockout) > at ? activeLockout : 0,
      ammo.charges === 0 ? Number(ammo.nextRechargeAt || 0) : 0
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
  const ensureAmmo = (skill: Skill, at = state.time): AmmoState | null => {
    const maximum = Math.max(0, Number(maximumAmmo(skill) || 0));
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeWork: Math.max(0, Number(rechargeDuration(skill, at) || 0)) * rate(skill),
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
    const ammo = ensureAmmo(skill, at);
    if (!ammo) return null;
    if (ammo.lockoutProgress) ammo.lockoutReadyAt = project(skill, ammo.lockoutProgress);
    if (ammo.nextRechargeAt != null && ammo.rechargeProgress)
      ammo.nextRechargeAt = project(skill, ammo.rechargeProgress);
    while (ammo.nextRechargeAt != null && gw2CooldownReadyAt(ammo.nextRechargeAt) <= at) {
      const completedAt = gw2CooldownReadyAt(ammo.nextRechargeAt);
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      // A serial charge begins recharging when the previous charge is detected as complete.
      if (ammo.charges < ammo.maximum) {
        ammo.rechargeProgress = {
          startedAt: completedAt,
          work: ammo.rechargeWork + Math.min(0, ammo.rechargeProgress?.work ?? 0)
        };
        ammo.nextRechargeAt = project(skill, ammo.rechargeProgress);
      } else {
        ammo.nextRechargeAt = null;
        delete ammo.rechargeProgress;
      }
    }

    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /**
   * Spends one charge and, when needed, starts the recharge timer.
   */
  const spendAmmo = (skill: Skill, at: number, committedRechargeWork?: number): void => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.charges <= 0) return;
    ammo.charges -= 1;
    if (ammo.nextRechargeAt == null) {
      // A cast carries its selected recharge through completion; direct resource spends still query at their anchor.
      ammo.rechargeWork = Math.max(0, committedRechargeWork ?? rechargeDuration(skill, at) * rate(skill));
      ammo.rechargeProgress = { startedAt: at, work: ammo.rechargeWork };
      ammo.nextRechargeAt = project(skill, ammo.rechargeProgress);
    }

    syncAmmoCooldown(skill, ammo, at);
  };

  /** Restores charges without erasing lockouts; callers choose whether a full pool retains recharge progress. */
  const restoreAmmo = (skill: Skill, count: number, at: number, whenFull: 'retain' | 'reset'): number => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo) return 0;
    // Restore only available capacity; negative requests or an already-full pool grant nothing.
    const restored = clamp(Number(count) || 0, 0, ammo.maximum - ammo.charges);
    if (!restored) return 0;
    ammo.charges += restored;
    if (ammo.charges >= ammo.maximum && whenFull === 'reset') {
      ammo.nextRechargeAt = null;
      delete ammo.rechargeProgress;
    }

    syncAmmoCooldown(skill, ammo, at);
    return restored;
  };

  /**
   * Reduces serial count recharge, carrying overflow into later missing
   * charges. Called through reduceSkillRecharge; returns the wall time recovered.
   */
  const reduceAmmoRecharge = (skill: Skill, requested: number, at: number): number => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.nextRechargeAt == null) return 0;

    const missingCharges = Math.max(0, ammo.maximum - ammo.charges);
    if (!ammo.rechargeProgress) throw new Error('An active ammo recharge requires base progress.');
    const currentWork = remaining(skill, ammo.rechargeProgress, at) + Math.min(0, ammo.rechargeProgress.work);
    const chargeWork = ammo.rechargeWork;
    const remainingUntilFull = Math.max(0, currentWork + Math.max(0, missingCharges - 1) * chargeWork);
    const reducedWork = Math.min(requested, remainingUntilFull);
    // Negative work carries a single reduction through later missing charges at the same detection tick.
    ammo.rechargeProgress = { startedAt: at, work: currentWork - reducedWork };
    ammo.nextRechargeAt = project(skill, ammo.rechargeProgress);
    refreshAmmo(skill, at);
    return reducedWork / rate(skill);
  };

  /** Applies game-adjusted recharge progress to ammo or an ordinary cooldown without passing its ready time. */
  const reduceSkillRecharge = (skill: Skill, reduction: number, at = state.time): number => {
    const requested = Math.max(0, Number(reduction) || 0);
    if (requested <= 0) return 0;
    if (state.ammo.has(skill.id)) {
      return reduceAmmoRecharge(skill, requested, at);
    }

    const progress = state.rechargeProgress.get(skill.id);
    if (!progress) {
      // Explicit fixed deadlines keep their existing policy when reduced.
      const readyAt = state.cooldowns.get(skill.id) || 0;
      const reducedBy = clamp(requested / rate(skill), 0, readyAt - at);
      if (reducedBy) setReadyAt(skill.id, readyAt - reducedBy);
      return reducedBy;
    }

    const work = remaining(skill, progress, at);
    const reducedWork = Math.min(requested, work);
    if (!reducedWork) return 0;
    startRecharge(skill, at, work - reducedWork);
    return reducedWork / rate(skill);
  };

  /**
   * Applies base work for the short between-cast recharge independently from count recharge.
   */
  const setAmmoLockout = (skill: Skill, work: number, at = state.time): void => {
    const ammo = ensureAmmo(skill, at);
    if (!ammo) return;
    const progress = { startedAt: at, work: Math.max(0, work) };
    const projected = project(skill, progress);
    const previous = ammo.lockoutProgress ? project(skill, ammo.lockoutProgress) : Number(ammo.lockoutReadyAt || 0);
    // Extending a lockout preserves work already accrued on the longer timer.
    if (projected >= previous) ammo.lockoutProgress = progress;
    ammo.lockoutReadyAt = Math.max(previous, projected);
    syncAmmoCooldown(skill, ammo, at);
  };

  return Object.freeze({
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
