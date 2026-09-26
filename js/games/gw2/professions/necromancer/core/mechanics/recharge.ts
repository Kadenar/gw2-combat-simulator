import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Aligns Isolate's recharge start to the cast progress where its flip activates. */
export function modifyNecromancerRechargeStart(
  context: {
    readonly skill?: NecromancerSkill;
    readonly start: number;
  },
  rechargeStart: number
): number {
  if (context.skill?.id !== ID.ISOLATE || context.skill.flipActivationAtMs == null) return rechargeStart;
  const baseCastMs = Number(context.skill.castTimeMs || 0);
  const activationProgress = baseCastMs > 0 ? Number(context.skill.flipActivationAtMs) / baseCastMs : 1;
  return context.start + (rechargeStart - context.start) * activationProgress;
}
