import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult
} from '#gw2/platform/builds/types.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { signetBuildAttributes } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { getActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';

/** Signet passives complement native trait contributions using the selected skill bar. */
export function applyWarriorBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    warriorCatalog,
    getActiveTraits
  );
  return finalizeProfessionBuildAttributes(
    common,
    { activeTraits, attributeEffects: signetBuildAttributes(profileContext, hasSelectedSkill) },
    context
  );
}
