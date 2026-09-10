/**
 * Shared cooldown and ammo-charge recharge state machine. Owns the common
 * between-cast lockout and charge bookkeeping (recharge timers, charge
 * depletion, recharge reduction) so professions only override maximum ammo and
 * recharge duration instead of reimplementing the mechanics.
 */
import { EPSILON } from '#kernel/core/clock.js';
import type { AmmoState, CooldownController, SchedulerState } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

interface CooldownControllerOptions<TProfessionState extends object> {
  readonly state: SchedulerState<TProfessionState>;
  readonly epsilon?: number;
  readonly rechargeDuration: (skill: Skill, at: number) => number;
  readonly maximumAmmo?: (skill: Skill) => number;
}

/**
 * Owns common cooldown and ammo recharge bookkeeping. Professions may override
 * maximum ammo and recharge calculation without duplicating the state machine.
 *
 */
export function createCooldownController<TProfessionState extends object>({
  state,
  epsilon = EPSILON,
  rechargeDuration,
  maximumAmmo = (skill) => Number(skill.ammo || 0)
}: CooldownControllerOptions<TProfessionState>): Readonly<CooldownController> {
  if (!state?.ammo || !state?.cooldowns) {
    throw new TypeError('Cooldown controller requires scheduler state.');
  }

  if (typeof rechargeDuration !== 'function') {
    throw new TypeError('Cooldown controller requires rechargeDuration.');
  }

  const ammoMaximum = (skill: Skill): number => Math.max(0, Number(maximumAmmo(skill) || 0));

  const syncAmmoCooldown = (skill: Skill, ammo: AmmoState, at: number): void => {
    // Derive availability from independent deadlines so returning a charge cannot erase a cast lockout.
    const activeLockout = Number(ammo.lockoutReadyAt || 0);
    const readyAt = Math.max(
      activeLockout > at + epsilon ? activeLockout : 0,
      ammo.charges === 0 ? Number(ammo.nextRechargeAt || 0) : 0
    );
    if (readyAt > at + epsilon) {
      state.cooldowns.set(skill.id, readyAt);
    } else {
      state.cooldowns.delete(skill.id);
    }
  };

  /**
   * Lazily initializes ammo tracking for skills that use charges.
   */
  const ensureAmmo = (skill: Skill, at = state.time): AmmoState | null => {
    const maximum = ammoMaximum(skill);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeDuration: Math.max(0, Number(rechargeDuration(skill, at) || 0)),
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
    while (ammo.nextRechargeAt != null && ammo.nextRechargeAt <= at + epsilon) {
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      ammo.nextRechargeAt = ammo.charges < ammo.maximum ? ammo.nextRechargeAt + ammo.rechargeDuration : null;
    }

    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /**
   * Spends one charge and, when needed, starts the recharge timer.
   */
  const spendAmmo = (skill: Skill, at: number, committedRechargeDuration?: number): AmmoState | false => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.charges <= 0) return false;
    ammo.charges -= 1;
    if (ammo.nextRechargeAt == null) {
      // A cast carries its selected recharge through completion; direct resource spends still query at their anchor.
      ammo.rechargeDuration = Math.max(0, Number(committedRechargeDuration ?? rechargeDuration(skill, at)) || 0);
      ammo.nextRechargeAt = at + ammo.rechargeDuration;
    }

    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /** Restores charges without erasing lockouts; callers choose whether a full pool retains recharge progress. */
  const restoreAmmo = (skill: Skill, count: number, at: number, whenFull: 'retain' | 'reset'): number => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo) return 0;
    const restored = Math.min(Math.max(0, Number(count) || 0), Math.max(0, ammo.maximum - ammo.charges));
    if (!restored) return 0;
    ammo.charges += restored;
    if (ammo.charges >= ammo.maximum && whenFull === 'reset') ammo.nextRechargeAt = null;
    syncAmmoCooldown(skill, ammo, at);
    return restored;
  };

  /**
   * Reduces serial count recharge, carrying overflow into later missing
   * charges. Reduction is capped only when the skill reaches maximum ammo.
   */
  const reduceAmmoRecharge = (
    skill: Skill,
    reduction: number,
    at = state.time
  ): { ammo: AmmoState | null; reducedBy: number } => {
    const ammo = refreshAmmo(skill, at);
    const requested = Math.max(0, Number(reduction) || 0);
    if (!ammo || ammo.nextRechargeAt == null || requested <= 0) {
      return { ammo, reducedBy: 0 };
    }

    const previous = ammo.nextRechargeAt;
    const missingCharges = Math.max(0, ammo.maximum - ammo.charges);
    const remainingUntilFull = Math.max(0, previous - at) + Math.max(0, missingCharges - 1) * ammo.rechargeDuration;
    const reducedBy = Math.min(requested, remainingUntilFull);

    ammo.nextRechargeAt = previous - reducedBy;
    refreshAmmo(skill, at);
    return { ammo, reducedBy };
  };

  /** Reduces either an active ammo recharge or an ordinary skill cooldown without passing its ready time. */
  const reduceSkillRecharge = (skill: Skill, reduction: number, at = state.time): number => {
    const requested = Math.max(0, Number(reduction) || 0);
    if (requested <= 0) return 0;
    if (state.ammo.has(skill.id)) {
      return reduceAmmoRecharge(skill, requested, at).reducedBy;
    }

    const readyAt = Number(state.cooldowns.get(skill.id) || 0);
    if (readyAt <= at + epsilon) return 0;
    const reducedBy = Math.min(requested, readyAt - at);
    state.cooldowns.set(skill.id, readyAt - reducedBy);
    return reducedBy;
  };

  /**
   * Applies the short between-cast recharge independently from count recharge.
   */
  const setAmmoLockout = (skill: Skill, readyAt: number, at = state.time): AmmoState | null => {
    const ammo = ensureAmmo(skill, at);
    if (!ammo) return null;
    ammo.lockoutReadyAt = Math.max(Number(ammo.lockoutReadyAt || 0), Number(readyAt || 0));
    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  return Object.freeze({
    ammoMaximum,
    ensureAmmo,
    reduceAmmoRecharge,
    reduceSkillRecharge,
    refreshAmmo,
    restoreAmmo,
    setAmmoLockout,
    spendAmmo
  });
}
