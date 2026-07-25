/**
 * Final ID-keyed mechanics map consumed by the profession catalog.
 */

import { SKILLS } from "../data/mesmer-catalog.js";
import { MESMER_SKILL_DEFAULTS } from "./skill-defaults.js";
import {
  implemented,
} from "../../../platform/engine/skill-factories.js";
import {
  mesmerAutoattackChainPosition,
} from "./autoattack-chains.js";
import {
  AMBUSH_SKILLS,
  isEngineHandledSkill,
  MESMER_SKILL_OVERRIDES,
  PSEUDO_SKILLS,
} from "./skill-overrides.js";

export const MESMER_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(SKILLS.map(skill => {
    const defaults = MESMER_SKILL_DEFAULTS[skill.id];
    if (!defaults) {
      throw new Error(`${skill.name} is missing Mesmer skill mechanics.`);
    }
    const chain = mesmerAutoattackChainPosition(skill.id);
    return [skill.id, implemented({
      ...defaults,
      ...(chain
        ? {
            chainRoot: chain.root,
            chainStep: chain.step,
            nextChainId: chain.next,
          }
        : {}),
      ...(isEngineHandledSkill(skill.id)
        ? {
            damage: [],
            conditions: [],
          }
        : {}),
      effects: [],
      ...(MESMER_SKILL_OVERRIDES[skill.id] || {}),
    })];
  })),
);

export const MESMER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(MESMER_SKILL_MECHANICS).map(Number),
);

export const MESMER_EXTRA_SKILLS = Object.freeze([
  ...AMBUSH_SKILLS,
  ...PSEUDO_SKILLS,
].map(skill => {
  const override = MESMER_SKILL_OVERRIDES[skill.id] || {};
  return Object.freeze({
    ...skill,
    ...override,
    implemented: true,
    effects: override.effects || skill.effects || [],
  });
}));
