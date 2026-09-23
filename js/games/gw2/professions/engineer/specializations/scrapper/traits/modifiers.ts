import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { kineticAcceleratorBoons } from '#gw2/professions/engineer/specializations/scrapper/traits/kinetic-accelerators.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { applyEngineerSharpshooterConditionDamage } from '#gw2/professions/engineer/core/traits/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { EngineerMaximumAmmoContext, EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';

import { applyScrapperCastTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';

/** Predict combo boons for scheduling; resolution alone commits their combat applications. */
function observeScrapperScheduledEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (event.schedulerPrediction !== 'combo-result') return;
  for (const boon of kineticAcceleratorBoons(context, event)) {
    emitSkillBuff(context, { ...boon, cause: event, schedulerBoonPrediction: true });
  }
}

export const scrapperSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: 'engineer.kinetic-accelerators',
    order: 30,
    handler: observeScrapperScheduledEvent
  },
  // order 30 runs after core engineer hooks (10/20) but before any finisher hooks
  afterCast: {
    id: 'engineer.scrapper-traits',
    order: 30,
    handler: applyScrapperCastTraits
  }
});

export const scrapperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Object in Motion: +5% strike damage per active movement status (stability/swiftness/superspeed).
    // Multiplicative — three statuses = 1.05^3 ≈ +15.8%.
    id: 'engineer.object-in-motion',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damageFactorPerBoon: 1.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const count = ['stability', 'swiftness', 'superspeed'].filter(
        (kind) => activeBoonStacks(context, kind, 1) > 0
      ).length;
      return parameters.damageFactorPerBoon ** count;
    },
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.OBJECT_IN_MOTION)
  }
]);

// Applied Force (GM trait): each might stack (capped at 25) adds 30 flat power at cast time.
function modifyScrapperAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  const modified = {
    ...attributes,
    power:
      Number(attributes.power || 0) +
      activeBoonStacks(
        context,
        'might',
        balanceProfileNumberFromContext(context, PROFILE.appliedForce, 'maximumStacks')
      ) *
        balanceProfileNumberFromContext(context, PROFILE.appliedForce, 'attributePerStack')
  };
  // Core converts Power before Applied Force runs, so refresh Sharpshooter with the final Power.
  applyEngineerSharpshooterConditionDamage(context, modified);
  return modified;
}

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.
function modifyScrapperMaximumAmmo(context: EngineerMaximumAmmoContext, maximum: number): number {
  return context.skill?.id === ID.FUNCTION_GYRO && hasTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(balanceProfileNumberFromContext(context, TRAIT.EX_MACHINA, 'maximumAmmo'), Number(maximum || 0))
    : maximum;
}

export const scrapperAttributeRules = Object.freeze({
  modifyAttributes: modifyScrapperAttributes,
  modifierRules: scrapperModifierRules
});

export const scrapperCastRules = Object.freeze({
  modifyMaximumAmmo: modifyScrapperMaximumAmmo
});
