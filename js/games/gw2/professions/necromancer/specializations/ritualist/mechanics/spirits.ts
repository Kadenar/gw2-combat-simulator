import { effectNumber, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

import { strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */

import type { SkillId } from '#gw2/platform/skills/types.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

import { spiritAttackEffects } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';

interface SpiritDefinition {
  readonly key: string;
  readonly initialBusyMs: number;
  readonly autoattackImpactDelayMs: number;
  readonly attackCoefficient: number;
  readonly attackWeaponStrength?: number;
  readonly summonTicks: readonly SpiritStrikeTick[];
  readonly lingeringTicks: readonly SpiritStrikeTick[];
  readonly activeTicks: readonly SpiritStrikeTick[];
  readonly activeDuration: number;
}

interface SpiritStrikeTick {
  readonly atMs: number;
  readonly coefficient: number;
}

// Decode each spirit's named balance-profile effects into its initial,
// autonomous, lingering, and active attack timings.
export function spiritDefinition(context: NecromancerRuntime, skillId: SkillId): SpiritDefinition | undefined {
  const attacks = spiritAttackEffects(context, skillId);
  if (!attacks) return undefined;
  const { key, profile, autoattack, active } = attacks;
  // Procedural spirit scheduling consumes the same canonical packet timelines as declarative skills; a removed
  // attack contributes no ticks.
  const ticks = (effect: StrikeEffect | undefined): readonly SpiritStrikeTick[] =>
    effect ? strikeEffectTicks(effect).map((tick) => ({ atMs: tick.atMs, coefficient: tick.coefficient })) : [];
  return {
    key,
    initialBusyMs: balanceProfileNumber(profile, 'initialBusyMs'),
    autoattackImpactDelayMs: balanceProfileNumber(profile, 'autoattackImpactDelayMs'),
    // A removed autoattack leaves a zero coefficient, which disables the autonomous loop.
    attackCoefficient: autoattack ? effectNumber(profile, autoattack, 'coefficient') : 0,
    attackWeaponStrength: balanceProfileNumber(profile, 'weaponStrength'),
    summonTicks: ticks(attacks.initial),
    lingeringTicks: ticks(attacks.lingering),
    activeTicks: ticks(active),
    activeDuration: active ? effectNumber(profile, active, 'duration') : 0
  };
}
