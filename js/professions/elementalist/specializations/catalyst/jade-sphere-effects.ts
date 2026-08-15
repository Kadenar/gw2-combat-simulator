import { ELEMENTALIST_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillEffect } from "../../../../platform/engine/types.js";

const JADE_SPHERE_TICKS = Object.freeze([0, 1000, 2000, 3000, 4000, 5000]);

function jadeSphereEffects(
  boon: string,
  duration: number,
): readonly SkillEffect[] {
  return [
    {
      type: "strike",
      ticks: JADE_SPHERE_TICKS.map((atMs) => ({
        atMs,
        coefficient: 0.25,
        metadata: { damageKind: "field-tick" },
      })),
      timingAnchor: "castStart",
      timingScale: "cast",
    },
    ...JADE_SPHERE_TICKS.map((atMs) => ({
      type: "boon" as const,
      boon,
      stacks: 1,
      duration,
      durationScale: "boon" as const,
      atMs,
      timingAnchor: "castStart" as const,
      timingScale: "cast" as const,
      metadata: {},
    })),
  ];
}

export const CATALYST_JADE_SPHERE_EFFECTS: Readonly<
  Record<number, readonly SkillEffect[]>
> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: jadeSphereEffects("Might", 10),
  [ID.DEPLOY_JADE_SPHERE_WATER]: jadeSphereEffects("Resolution", 1),
  [ID.DEPLOY_JADE_SPHERE_AIR]: jadeSphereEffects("Fury", 1),
  [ID.DEPLOY_JADE_SPHERE_EARTH]: jadeSphereEffects("Protection", 1),
});
