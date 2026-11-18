/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */
import { strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import type { StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import { effectNumber, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { spiritAttackEffects } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** One authored strike and its packet timeline; emission reads payload fields from the effect. */
export interface SpiritAttack {
  readonly effect: StrikeEffect;
  readonly ticks: readonly StrikeTick[];
}

/** Canonical spirit attack and lifetime data shared by scheduling and active skills. */
export interface SpiritDefinition {
  readonly key: string;
  readonly initialBusyMs: number;
  readonly resummonBusyMs: number;
  readonly autoattackImpactDelayMs: number;
  /** Absent when removed or zero-coefficient, which disables the autonomous loop. */
  readonly autoattack?: StrikeEffect;
  readonly summon?: SpiritAttack;
  readonly lingering?: SpiritAttack;
  readonly active?: SpiritAttack;
  readonly activeDuration: number;
}

// Decode each spirit's named skill and action effects into its initial,
// autonomous, lingering, and active attacks.
export function spiritDefinition(context: NecromancerRuntime, skillId: SkillId): SpiritDefinition | undefined {
  const attacks = spiritAttackEffects(context.helpers, skillId);

  if (!attacks) return undefined;

  const { key, profile, autoattack, active } = attacks;
  // Procedural spirit scheduling consumes the same canonical packet timelines as declarative skills; a removed
  // attack or an empty timeline contributes no packets.
  const attack = (effect: StrikeEffect | undefined): SpiritAttack | undefined => {
    if (!effect) return undefined;

    const ticks = strikeEffectTicks(effect);
    return ticks.length ? { effect, ticks } : undefined;
  };

  return {
    key,
    initialBusyMs: skillNumber(profile, 'initialBusyMs'),
    resummonBusyMs: skillNumber(profile, 'resummonBusyMs'),
    autoattackImpactDelayMs: skillNumber(profile, 'autoattackImpactDelayMs'),
    autoattack: autoattack && effectNumber(profile, autoattack, 'coefficient') > 0 ? autoattack : undefined,
    summon: attack(attacks.initial),
    lingering: attack(attacks.lingering),
    active: attack(active),
    // Defensive commands still interrupt attacks and keep their spirit busy until their animation completes.
    activeDuration: active ? effectNumber(profile, active, 'duration') : skillNumber(profile, 'commandBusyMs') / 1000
  };
}
