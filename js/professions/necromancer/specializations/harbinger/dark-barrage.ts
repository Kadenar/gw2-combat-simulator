import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { emitCondition, emitDamage, hasTrait } from "../../core/shared.js";
import type { NecromancerCastContext, NecromancerSkill } from "../../types.js";

export function darkBarrage(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  if (!hasTrait(context, TRAIT.DOOM_APPROACHES)) return false;
  const hits = 8;
  const interval = 0.75 / hits;
  const at = context.start + interval;
  emitDamage(context, skill, 4.8, {
    at,
    hits,
    interval,
  });
  for (let index = 0; index < hits; index += 1) {
    emitCondition(context, skill, "Torment", 1, 3, {
      at: at + index * interval,
    });
  }
  return true;
}
