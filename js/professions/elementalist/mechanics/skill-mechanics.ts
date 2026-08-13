import type { SkillFragment } from "../../../platform/engine/types.js";

function mechanic(
  ids: readonly number[],
  stateMachine: string,
): Readonly<Record<string, SkillFragment>> {
  return Object.fromEntries(
    ids.map((id) => [id, { elementalistStateMachine: stateMachine }]),
  );
}

export const ELEMENTALIST_SKILL_MECHANICS: Readonly<
  Record<string, SkillFragment>
> = Object.freeze({
  ...mechanic([1100276], "summoned-elemental"),
  ...mechanic([1100036, 1100037], "rock-barrier"),
  ...mechanic([1100023, 1100068, 1100073, 1100083], "aura-transmute"),
  ...mechanic(
    [
      1100256, 1100257, 1100259, 1100260, 1100262, 1100267, 1100268, 1100269,
      1100270, 1100271, 1100272, 1100273, 1100275,
    ],
    "pistol-bullets",
  ),
  ...mechanic([1100228, 1100235, 1100240, 1100245, 1100248], "hammer-orbs"),
  ...mechanic([1100194, 1100201, 1100208, 1100215], "spear-followup"),
  ...mechanic(
    [
      1100196, 1100197, 1100198, 1100203, 1100204, 1100205, 1100210, 1100211,
      1100212, 1100217, 1100218, 1100219,
    ],
    "spear-etching",
  ),
  ...mechanic(
    [1100179, 1100180, 1100181, 1100182, 1100183, 1100184, 1100185, 1100186],
    "evoker-familiar",
  ),
});
