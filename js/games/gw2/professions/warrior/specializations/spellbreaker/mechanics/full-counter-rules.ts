import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileFromContext,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { syncWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';
import { observeSpellbreakerEvent } from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
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
  return activeStackCount(state?.attackerInsightExpiries || [], context.time);
}

function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  return (
    readProfessionSpecializationState<{ magebaneTetherUntil?: number }>(context.runtime?.profession, 'Spellbreaker') ||
    {}
  );
}

function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const bonus =
    insightStacks(context) * balanceProfileNumberFromContext(context, PROFILE.attackersInsight, 'attributePerStack');
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
    // The target never has boons, so the full bonus always applies.
    factor: (context) => balanceProfileNumberFromContext(context, TRAIT.PURE_STRIKE, 'criticalDamage'),
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
      gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Dagger'
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
