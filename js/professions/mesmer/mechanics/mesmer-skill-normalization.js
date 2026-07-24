import { SKILLS as CATALOG_SKILLS } from "../data/mesmer-catalog.js";
import { BASE_SKILL_DATA_BY_ID } from "../data/mesmer-skill-mechanics.js";
import {
  autoattackChainPosition,
  isEngineHandledSkill,
  skillOverride,
} from "./mesmer-skill-overrides.js";

/**
 * Produces the canonical simulator representation of one generated catalog skill.
 */
export function normalizedSkill(skill) {
  const base = BASE_SKILL_DATA_BY_ID[skill.id] || {};
  const override = skillOverride(skill.name);
  const chain = autoattackChainPosition(skill.name);
  const normalized = {
    ...skill,
    ...base,
    ...override,
    damage: override.damage || base.damage || skill.damage,
    conditions: override.conditions || base.conditions || skill.conditions,
    resource:
      Object.hasOwn(override, "resource")
        ? override.resource
        : Object.hasOwn(base, "resource")
          ? base.resource
          : skill.resource,
  };
  if (chain) {
    normalized.chainRoot = chain.root;
    normalized.chainStep = chain.step;
  }
  if (isEngineHandledSkill(skill.name)) {
    normalized.damage = [];
    normalized.conditions = [];
  }
  return normalized;
}

/** Canonical catalog-backed skills consumed by the UI and simulator. */
export const SIMULATOR_SKILLS = CATALOG_SKILLS.map(normalizedSkill);
