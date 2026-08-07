import type {
  HarbingerState,
  NecromancerConfig,
} from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createHarbingerState(
  config: NecromancerConfig = {},
): HarbingerState {
  const initialBlight = Math.max(
    0,
    Math.min(25, Math.trunc(Number(config.initialBlight || 0))),
  );
  return {
    nextBlightAt: Number.POSITIVE_INFINITY,
    blight: initialBlight,
    blightExpiries: Array.from({ length: initialBlight }, () => 25),
    cascadingCorruptionStacks: 0,
    meltdownUntil: 0,
  };
}

export const harbingerState = defineProfessionSpecializationState(
  "Harbinger",
  createHarbingerState,
);
