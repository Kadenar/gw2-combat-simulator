import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import {
  professionCoreState,
  readProfessionSpecializationState
} from '../../../../platform/engine/profession/state.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import { warriorBalanceProfile } from '../../core/profiles.js';
import { syncWarriorAdrenaline } from '../../core/resources.js';
import type { WarriorSchedulerContext } from '../../types.js';
import { observeSpellbreakerEvent } from './traits.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { gw2PrimaryWeapon } from '../../../../platform/gw2/equipment/weapons/loadout.js';

export const spellbreakerSchedulerHooks = Object.freeze({
  initialize: (context: WarriorSchedulerContext) => {
    professionCoreState(context).maximumAdrenaline = Number(
      warriorBalanceProfile(context, PROFILE.resources)?.maximumStacks ?? 20
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

function activePrimaryWeapon(context: Gw2ModifierContext): string {
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return String(gw2PrimaryWeapon(context.config, weaponSet) || '');
}

function modifyAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const bonus =
    insightStacks(context) * Number(warriorBalanceProfile(context, PROFILE.attackersInsight)?.attributePerStack ?? 50);
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
      activePrimaryWeapon(context) === 'Dagger' &&
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
