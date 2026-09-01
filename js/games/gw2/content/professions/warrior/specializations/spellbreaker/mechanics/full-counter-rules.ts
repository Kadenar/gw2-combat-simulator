import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';

import { syncWarriorAdrenaline } from '#gw2/content/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorSchedulerContext } from '#gw2/content/professions/warrior/types.js';
import { observeSpellbreakerEvent } from '#gw2/content/professions/warrior/specializations/spellbreaker/traits/index.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/specializations/spellbreaker/profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

export const spellbreakerSchedulerHooks = Object.freeze({
  initialize: (context: WarriorSchedulerContext) => {
    professionCoreState(context).maximumAdrenaline = Number(
      balanceProfileFromContext(context, PROFILE.resources)?.maximumStacks ?? 20
    );
    syncWarriorAdrenaline(context);
  },
  onEventScheduled: {
    id: 'warrior.attacker-insight',
    order: 20,
    handler: observeSpellbreakerEvent
  }
});

// Cast through an anonymous type rather than importing SpellbreakerState
// directly to avoid a circular dependency between rules and state modules.
function insightStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<{ attackerInsightExpiries?: number[] }>(
    context.runtime?.profession,
    'Spellbreaker'
  );
  return (state?.attackerInsightExpiries || []).filter((expiresAt) => expiresAt > context.time).length;
}

function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  return (
    readProfessionSpecializationState<{ magebaneTetherUntil?: number }>(context.runtime?.profession, 'Spellbreaker') ||
    {}
  );
}

function modifyAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const bonus =
    insightStacks(context) *
    Number(balanceProfileFromContext(context, PROFILE.attackersInsight)?.attributePerStack ?? 50);
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.pure-strike',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    parameters: {
      boonedFactor: 1.05,
      boonlessFactor: 1.1
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      context.config?.target?.boonless ? parameters.boonlessFactor : parameters.boonedFactor,
    when: (context) => hasTrait(context, TRAIT.PURE_STRIKE)
  },
  {
    id: 'warrior.sun-and-moon-style',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.SUN_AND_MOON_STYLE) &&
      gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Dagger' &&
      context.config?.target?.boonless === true
  },
  {
    id: 'warrior.magebane-tether',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 110,
    when: (context) =>
      hasTrait(context, TRAIT.MAGEBANE_TETHER) &&
      Number(spellbreakerStateAt(context).magebaneTetherUntil || 0) > context.time
  }
]);

export const spellbreakerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules
});
