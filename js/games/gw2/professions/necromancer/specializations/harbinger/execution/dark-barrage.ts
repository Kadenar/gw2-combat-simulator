import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns the Doom Approaches replacement behavior for Dark Barrage.
 * The declarative Harbinger Shroud fragment remains in `skills/shroud-skills.ts`.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Replaces Dark Barrage with Doom Approaches' interruptible eight-hit damage and Torment sequence. */
export function darkBarrage(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  // Doom Approaches converts Dark Barrage from a single hit to 8 rapid pistol hits; without it this handler is a no-op.
  if (!hasTrait(context, TRAIT.DOOM_APPROACHES)) return false;
  const profile = requireBalanceProfileFromContext(context, PROFILE.darkBarrageDoomApproaches);
  // The rapid hits and their Torment are independent packets sharing the channel cadence.
  const strike = requireEffect(profile, 'strike', 'Strike');
  const condition = requireEffect(profile, 'condition', 'Torment');
  const hits = balanceProfileNumber(profile, 'pulseCount');
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  // The trait replacement remains a channel, so an interruption preserves only the rapid hits already fired.
  for (let index = 0; strike && index < hits; index += 1) {
    const at = context.start + (index + 1) * interval;
    if (at > context.effectiveEnd + EPSILON) continue;
    emitSkillDamage(context, skill, {
      at,
      coefficient: effectNumber(profile, strike, 'coefficient'),
      hitIndex: index + 1,
      totalHits: hits
    });
  }

  // Each hit applies Torment independently so each stack receives its own expiry timestamp.
  for (let index = 0; condition && index < hits; index += 1) {
    const at = context.start + (index + 1) * interval;
    if (at > context.effectiveEnd + EPSILON) continue;
    emitSkillCondition(context, {
      skill,
      at,
      condition: String(condition.condition),
      stacks: effectNumber(profile, condition, 'stacks'),
      duration: effectNumber(profile, condition, 'duration')
    });
  }

  return true;
}
