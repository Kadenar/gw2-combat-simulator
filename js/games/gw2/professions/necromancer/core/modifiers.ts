import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { modifySignetOfSpiteAttributes } from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { ghastlyClawsVulnerabilityModifier } from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { lifeSiphonBleedingModifier } from '#gw2/professions/necromancer/core/skills/weapons/dagger.js';
import {
  modifyFuriousDemiseAttributes,
  modifyLingeringCurseAttributes,
  modifyNecromancerConditionBaseDuration,
  modifyTargetTheWeakAttributes
} from '#gw2/professions/necromancer/core/traits/curses/modifiers.js';
import { modifyDeadlyStrengthAttributes } from '#gw2/professions/necromancer/core/traits/death-magic/carapace.js';
import { modifyVitalPersistenceAttributes } from '#gw2/professions/necromancer/core/traits/soul-reaping/modifiers.js';
import {
  modifyAwakenThePainAttributes,
  modifySpitefulFortitudeAttributes
} from '#gw2/professions/necromancer/core/traits/spite/behavior.js';

/** Applies Core Necromancer static conversions and runtime-dependent attribute bonuses. */
export function modifyNecromancerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  // Conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's power/condition damage) and live trait bonuses
  // (accrued on `result`).

  const staticRulesApplied = professionStaticRulesApplied(context.config);
  modifySignetOfSpiteAttributes(context, result);
  modifyDeadlyStrengthAttributes(context, result);
  modifyAwakenThePainAttributes(context, result);

  if (!staticRulesApplied) {
    modifySpitefulFortitudeAttributes(context, result);
    modifyFuriousDemiseAttributes(context, result);
    modifyTargetTheWeakAttributes(context, result);
    modifyLingeringCurseAttributes(context, result);
    modifyVitalPersistenceAttributes(context, result);
  }

  return result;
}

const necromancerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  { ...lifeSiphonBleedingModifier, order: -20 },
  { ...ghastlyClawsVulnerabilityModifier, order: 108 }
]);

export const necromancerCoreModifiers = Object.freeze({
  modifyAttributes: modifyNecromancerCoreAttributes,
  modifyConditionBaseDuration: modifyNecromancerConditionBaseDuration,
  modifierRules: necromancerCoreModifierRules
});
