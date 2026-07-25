/**
 * Final ID-keyed mechanics map consumed by the profession catalog.
 */

import {
  NECROMANCER_SKILL_DEFAULTS,
} from "./skill-defaults.js";
import {
  NECROMANCER_SKILL_OVERRIDES,
} from "./skill-overrides.js";

export const NECROMANCER_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(
    [...new Set([
      ...Object.keys(NECROMANCER_SKILL_DEFAULTS),
      ...Object.keys(NECROMANCER_SKILL_OVERRIDES),
    ])].map(id => {
      const definition = {
        ...(NECROMANCER_SKILL_DEFAULTS[id] || {}),
        ...(NECROMANCER_SKILL_OVERRIDES[id] || {}),
      };
      return [id, {
        ...definition,
        activation: Math.max(
          0,
          Number(definition.castTimeMs || 0),
        ) / 1000,
      }];
    }),
  ),
);

export const NECROMANCER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(NECROMANCER_SKILL_MECHANICS).map(Number),
);
