/**
 * Owns the Doom Approaches replacement behavior for Dark Barrage.
 * The declarative Harbinger Shroud fragment remains in `skills/shroud-skills.ts`.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/necromancer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';

/** Replaces Dark Barrage with Doom Approaches' interruptible eight-hit damage and Torment sequence. */
export function darkBarrage(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  // Doom Approaches converts Dark Barrage from a single hit to 8 rapid pistol hits; without it this handler is a no-op.
  if (!hasTrait(context, TRAIT.DOOM_APPROACHES)) return false;
  const hits = 8;
  // The 8 hits compress into 0.75 s regardless of cast speed; interval is a fixed game value, not skill-cast-derived.
  const interval = 0.75 / hits;
  // First hit lands one interval after cast start, not at start, matching the in-game projectile travel delay.
  const at = context.start + interval;
  // The trait replacement remains a channel, so an interruption preserves only the rapid hits already fired.
  const landedHits = Array.from({ length: hits }, (_, index) => at + index * interval).filter(
    (hitAt) => hitAt <= context.effectiveEnd + context.epsilon
  ).length;
  if (landedHits > 0) {
    emitSkillDamage(context, skill, {
      at,
      coefficient: 0.6 * landedHits,
      hits: landedHits,
      interval,
      totalHits: hits
    });
  }

  // Each hit applies Torment independently so each stack receives its own expiry timestamp.
  for (let index = 0; index < landedHits; index += 1) {
    emitSkillCondition(context, skill, {
      at: at + index * interval,
      condition: 'Torment',
      stacks: 1,
      duration: 3
    });
  }

  return true;
}
