import { GUARDIAN_BUNDLE_SKILLS } from "../data/guardian-bundle-skills.js";
import { SKILLS } from "../data/guardian-catalog.js";
import {
  deriveAutoattackChains,
} from "../../../platform/engine/autoattack-chains.js";

const ALL_GUARDIAN_SKILLS = Object.freeze([
  ...SKILLS,
  ...GUARDIAN_BUNDLE_SKILLS,
]);

export const GUARDIAN_AUTOATTACK_CHAINS = deriveAutoattackChains(
  ALL_GUARDIAN_SKILLS,
);
