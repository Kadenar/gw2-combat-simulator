import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { emitCondition, emitDamage, hasTrait } from "../../core/shared.js";
import type { NecromancerCastContext, NecromancerSkill } from "../../types.js";

export function darkBarrage(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  // Doom Approaches converts Dark Barrage from a single hit to 8 rapid pistol hits; without it this handler is a no-op.
  if (!hasTrait(context, TRAIT.DOOM_APPROACHES)) return false;
  const hits = 8;
  // The 8 hits compress into 0.75 s regardless of cast speed; interval is a fixed game value, not skill-cast-derived.
  const interval = 0.75 / hits;
  // First hit lands one interval after cast start, not at start, matching the in-game projectile travel delay.
  const at = context.start + interval;
  emitDamage(context, skill, 4.8, {
    at,
    hits,
    interval,
  });
  // Each of the 8 hits independently applies 1 stack of Torment — conditions are emitted per-hit so they each get their own expiry timestamp.
  for (let index = 0; index < hits; index += 1) {
    emitCondition(context, skill, "Torment", 1, 3, {
      at: at + index * interval,
    });
  }
  return true;
}
