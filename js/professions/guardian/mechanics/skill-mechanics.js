/**
 * Final ID-keyed mechanics map consumed by the profession catalog.
 */

import { GUARDIAN_SKILL_DEFAULTS } from "./skill-defaults.js";
import { GUARDIAN_SKILL_OVERRIDES } from "./skill-overrides.js";

export const GUARDIAN_SKILL_MECHANICS = Object.freeze({
  ...GUARDIAN_SKILL_DEFAULTS,
  ...GUARDIAN_SKILL_OVERRIDES,
});

export const GUARDIAN_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(GUARDIAN_SKILL_MECHANICS).map(Number),
);
