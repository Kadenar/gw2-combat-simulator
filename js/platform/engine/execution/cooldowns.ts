/**
 * Shared cooldown and ammo-charge recharge state machine. Owns the common
 * between-cast lockout and charge bookkeeping (recharge timers, charge
 * depletion, recharge reduction) so professions only override maximum ammo and
 * recharge duration instead of reimplementing the mechanics.
 */
import { EPSILON } from '../core/clock.js';
import type { AmmoState, CooldownController, SchedulerState, Skill } from '../types.js';

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
    const activeLockout = Number(state.cooldowns.get(skill.id) || 0);
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
  const spendAmmo = (skill: Skill, at: number): AmmoState | false => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.charges <= 0) return false;
    ammo.charges -= 1;
    if (ammo.nextRechargeAt == null) {
      ammo.rechargeDuration = Math.max(0, Number(rechargeDuration(skill, at) || 0));
      ammo.nextRechargeAt = at + ammo.rechargeDuration;
    }

    syncAmmoCooldown(skill, ammo, at);
    return ammo;
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

    // A depleted ammo skill mirrors its next count recharge into the shared
    // cooldown map. Remove that mirrored value before refreshing so it is not
    // mistaken for an independent between-cast lockout.
    if (ammo.charges === 0) {
      const readyAt = Number(state.cooldowns.get(skill.id) || 0);
      if (readyAt > previous + epsilon) {
        state.cooldowns.set(skill.id, readyAt);
      } else {
        state.cooldowns.delete(skill.id);
      }
    }

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
    state.cooldowns.set(skill.id, Math.max(Number(state.cooldowns.get(skill.id) || 0), Number(readyAt || 0)));
    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  return Object.freeze({
    ammoMaximum,
    ensureAmmo,
    reduceAmmoRecharge,
    reduceSkillRecharge,
    refreshAmmo,
    setAmmoLockout,
    spendAmmo
  });
}
