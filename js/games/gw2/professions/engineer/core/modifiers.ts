import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { flameJetModifier } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import { applyExplosiveTemperAttributes } from '#gw2/professions/engineer/core/traits/explosions.js';
import {
  applyChemicalRoundsAttributes,
  applyChemicalRoundsConditionDuration,
  applyNoScopeAttributes,
  applySharpshooterConditionAttributes,
  applyThermalVisionAttributes
} from '#gw2/professions/engineer/core/traits/behavior.js';
import { applyEnergyAmplifierAttributes } from '#gw2/professions/engineer/core/traits/behavior.js';
/** Trait attribute owners retain their original order before final damage calculations. */
function modifyEngineerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
  applyChemicalRoundsAttributes(context, modified);
  applyThermalVisionAttributes(context, modified);
  applyEnergyAmplifierAttributes(context, modified);
  applyNoScopeAttributes(context, modified);
  applyExplosiveTemperAttributes(context, modified);
  return modified;
}

/** Flame Jet is the remaining skill-owned rule; trait definitions contribute all trait modifiers. */
export const engineerCoreModifiers = Object.freeze({
  modifyAttributes: modifyEngineerCoreAttributes,
  modifyConditionAttributes: applySharpshooterConditionAttributes,
  modifyConditionBaseDuration: applyChemicalRoundsConditionDuration,
  modifierRules: [flameJetModifier]
});
