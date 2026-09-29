import { deadeyeSkillModifiers } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import {
  applyBeQuickOrBeKilledAttributes,
  applyPremeditationAttributes,
  applySilentScopeAttributes
} from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';

import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';

function modifyDeadeyeAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  // Skip build-time attribute bonuses already recorded in attribute provenance to avoid double-counting.
  if (!professionStaticRulesApplied(context.config)) {
    applySilentScopeAttributes(context, result);

    applyPremeditationAttributes(context, result);
  }

  applyBeQuickOrBeKilledAttributes(context, result);

  return result;
}

export const deadeyeModifiers = Object.freeze({
  modifyAttributes: modifyDeadeyeAttributes,
  modifierRules: deadeyeSkillModifiers
});
