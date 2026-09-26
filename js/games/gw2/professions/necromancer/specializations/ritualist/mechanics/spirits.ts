import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

import { RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

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

// Each spirit declares only the attacks it owns; named packets keep their role after a sibling is removed.
const SPIRIT_ATTACKS: Readonly<
  Record<
    string,
    { readonly autoattack: string; readonly initial?: string; readonly lingering?: string; readonly active?: string }
  >
> = Object.freeze({
  anguish: {
    autoattack: 'Anguish Autoattack',
    initial: 'Anguish Initial Barrage',
    active: 'Summon Spirits - Anguish'
  },
  wanderlust: {
    autoattack: 'Wanderlust Autoattack',
    initial: 'Wanderlust Initial Swing',
    lingering: 'Wanderlust Initial Field',
    active: 'Summon Spirits - Wanderlust'
  },
  preservation: { autoattack: 'Preservation Autoattack' }
});

// Decode each spirit's named balance-profile effects into its initial,
// autonomous, lingering, and active attack timings.
export function spiritDefinition(context: NecromancerRuntime, skillId: SkillId): SpiritDefinition | undefined {
  const key =
    skillId === ID.ANGUISH
      ? 'anguish'
      : skillId === ID.WANDERLUST
        ? 'wanderlust'
        : skillId === ID.PRESERVATION
          ? 'preservation'
          : '';
  if (!key) return undefined;
  const profile = requireBalanceProfileFromContext(context, RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[Number(skillId)]);
  const attacks = SPIRIT_ATTACKS[key];
  const strike = (name: string | undefined) => (name ? requireEffect(profile, 'strike', name) : undefined);
  const autoattack = strike(attacks.autoattack);
  const active = strike(attacks.active);
  // Procedural spirit scheduling consumes the same canonical packet timelines as declarative skills; a removed
  // attack contributes no ticks.
  const ticks = (effect: ReturnType<typeof strike>): readonly SpiritStrikeTick[] =>
    effect
      ? strikeEffectTicks(effect).map((tick) => ({ atMs: Number(tick.atMs), coefficient: Number(tick.coefficient) }))
      : [];
  return {
    key,
    initialBusyMs: balanceProfileNumber(profile, 'initialBusyMs'),
    autoattackImpactDelayMs: balanceProfileNumber(profile, 'autoattackImpactDelayMs'),
    // A removed autoattack leaves a zero coefficient, which disables the autonomous loop.
    attackCoefficient: autoattack ? effectNumber(profile, autoattack, 'coefficient') : 0,
    attackWeaponStrength: balanceProfileNumber(profile, 'weaponStrength'),
    summonTicks: ticks(strike(attacks.initial)),
    lingeringTicks: ticks(strike(attacks.lingering)),
    activeTicks: ticks(active),
    activeDuration: active ? effectNumber(profile, active, 'duration') : 0
  };
}
