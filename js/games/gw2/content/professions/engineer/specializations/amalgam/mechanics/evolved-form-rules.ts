import { professionStaticRulesApplied } from '../../../../../../platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '../../../../../../platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierEligibleEvent } from '../../../../../../platform/combat/state/event-ownership.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import {
  activeBoonStacks,
  activeEngineerSpecializationState,
  cloneEngineerAttributes,
  eventSkill
} from '../../../core/traits/query-helpers.js';
import { applyEngineerSharpshooterConditionDamage } from '../../../core/traits/modifiers.js';
import { engineerBalanceValue } from '../../../core/profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';
import { amalgamCastAvailability } from './availability.js';
import type { SchedulerRecord } from '../../../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../../../platform/combat/modifiers/types.js';
import type { EngineerEvolveAttributePool, EngineerMaximumAmmoContext } from '../../../types.js';
import { handleMercurialTendencies, observeAmalgamScheduledEvent } from './evolved-form.js';

export const amalgamSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: 'engineer.amalgam-events',
    order: 20,
    handler: observeAmalgamScheduledEvent
  },
  taskHandlers: Object.freeze({
    'engineer.mercurial-tendencies': handleMercurialTendencies
  })
});

// Evolved adds 10% of its eligible stat pool, or 20% with Double Helix.
// Derived armor/crit fields update from toughness, ferocity, and precision.
const EVOLVE_ATTRIBUTES = Object.freeze([
  ['power', 'Power'],
  ['precision', 'Precision'],
  ['toughness', 'Toughness'],
  ['vitality', 'Vitality'],
  ['ferocity', 'Ferocity'],
  ['conditionDamage', 'Condition Damage'],
  ['expertise', 'Expertise'],
  ['concentration', 'Concentration'],
  ['healingPower', 'Healing Power']
] as const);

function morphStrike(context: Gw2ModifierContext): boolean {
  return Boolean(isGw2PlayerModifierEligibleEvent(context.event) && eventSkill(context)?.categories?.includes('Morph'));
}

export const amalgamModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.willing-host',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.WILLING_HOST) &&
      activeEngineerSpecializationState(context, 'Amalgam', 'willingHostUntil')
  },
  {
    id: 'engineer.symbiotic-synergy',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.33,
    when: (context) => hasTrait(context, TRAIT.SYMBIOTIC_SYNERGY) && morphStrike(context)
  },
  {
    id: 'engineer.plasmatic-state',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      activeEngineerSpecializationState(context, 'Amalgam', 'plasmaticStateUntil')
  },
  {
    id: 'engineer.carbolic-composition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.33,
    // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
    when: (context) =>
      context.condition === 'Poisoned' &&
      hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) &&
      !professionStaticRulesApplied(context.config)
  }
]);

function modifyAmalgamAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  if (activeEngineerSpecializationState(context, 'Amalgam', 'evolvedUntil')) {
    const evolveFactor = hasTrait(context, TRAIT.DOUBLE_HELIX)
      ? engineerBalanceValue(context, PROFILE.evolve, 'coefficientMultiplier', 1.2)
      : engineerBalanceValue(context, PROFILE.evolve, 'damageMultiplier', 1.1);
    const pool = context.config?.amalgamEvolveAttributePool as EngineerEvolveAttributePool | undefined;
    for (const [attribute, poolAttribute] of EVOLVE_ATTRIBUTES) {
      const eligible = Number(pool?.[poolAttribute] ?? modified[attribute] ?? 0);
      const bonus = eligible * (evolveFactor - 1);
      modified[attribute] =
        Number(modified[attribute] || 0) +
        (['power', 'conditionDamage'].includes(attribute) ? Math.round(bonus) : bonus);
    }
  }

  if (activeEngineerSpecializationState(context, 'Amalgam', 'titanicUntil')) {
    // Titanic Strain adds 5 power + 5 condition damage per might stack on top
    // of the standard 30 power per stack that's already in the base attributes.
    const improvedMight =
      activeBoonStacks(context, 'might') * engineerBalanceValue(context, PROFILE.strains, 'attributePerStack', 5);
    modified.power += improvedMight;
    modified.conditionDamage += improvedMight;
  }

  // Amalgam modifies Power after Core runs, so finalize Sharpshooter here to
  // keep its replacement attribute based on Evolve and Titanic Power bonuses.
  applyEngineerSharpshooterConditionDamage(context, modified);
  return modified;
}

// Double Helix upgrades Evolve from a single-charge to a 2-ammo skill, which
// lets it store a second use while on cooldown.
function modifyAmalgamMaximumAmmo(context: EngineerMaximumAmmoContext, maximum: number): number {
  return context.skill?.name === 'Evolve' && hasTrait(context.config, TRAIT.DOUBLE_HELIX)
    ? Math.max(engineerBalanceValue(context, PROFILE.evolve, 'maximumStacks', 2), Number(maximum || 0))
    : maximum;
}

export const amalgamAttributeRules = Object.freeze({
  modifyAttributes: modifyAmalgamAttributes,
  modifierRules: amalgamModifierRules
});

export const amalgamCastRules = Object.freeze({
  availability: {
    id: 'engineer.amalgam-availability',
    order: 30,
    handler: amalgamCastAvailability
  },
  modifyMaximumAmmo: modifyAmalgamMaximumAmmo
});
