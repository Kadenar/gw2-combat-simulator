import { INFERRED_GUARDIAN_SKILL_MECHANICS } from "./skill-inference.js";
import { GUARDIAN_SKILL_OVERRIDES } from "./skill-overrides.js";

export const GUARDIAN_SKILL_MECHANICS = Object.freeze({
  ...INFERRED_GUARDIAN_SKILL_MECHANICS,
  ...GUARDIAN_SKILL_OVERRIDES,
});

export const GUARDIAN_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(GUARDIAN_SKILL_MECHANICS).map(Number),
);
