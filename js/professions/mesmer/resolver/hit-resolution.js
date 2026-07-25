import {
  createGw2HitResolution,
} from "../../../platform/gw2/resolver/hit-resolution.js";
import { targetHealthMultiplier } from "./damage-modifiers.js";

const hitResolution = createGw2HitResolution({
  targetHealthMultiplier,
});

export const {
  applyResolvedHit,
  buildHitResolutionContext,
} = hitResolution;
