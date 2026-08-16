import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
export function applyUnstoppableUnion(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (!hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) return;
  context.emit({
    type: "buff",
    at: context.start,
    source: "Trait",
    sourceId: TRAIT.UNSTOPPABLE_UNION,
    actorType: "effect",
    skillId: skill.id,
    skillName: "Unstoppable Union",
    kind: "protection",
    duration: 2.5,
    stacks: 1,
  });
}

export function soulbeastStanceDuration(
  context: RangerCastContext,
  baseDuration: number,
): number {
  return hasTrait(context, TRAIT.LEADER_OF_THE_PACK)
    ? baseDuration * 1.2
    : baseDuration;
}
