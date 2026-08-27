import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/combat/modifiers/rules.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { professionStaticRulesApplied } from '../../../platform/gw2/builds/attribute-provenance.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { prepareGw2BuffCompanionCandidates } from '../../../platform/gw2/combat/state/allied-players.js';
import { GW2_STANDARD_BOONS } from '../../../platform/gw2/combat/state/boons.js';
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerModifierEligibleEvent
} from '../../../platform/gw2/combat/state/event-ownership.js';
import {
  eventSkill as gw2EventSkill,
  hasSelectedSkill,
  targetConditionActive
} from '../../../platform/gw2/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotRangerState } from '../state.js';
import { rangerCoreCastAvailability } from './availability.js';
import { rangerPetByName } from './state.js';
import { advanceRangerResources } from './resources.js';
import { applyRangerWeaponSwapTraits, completeRangerTraits } from './traits.js';
import { updateRangerWeaponState } from './weapon-state.js';
import { beginRangerPetCommand, observeRangerPetEvent, rangerPetCompanionId, rangerPetTaskHandlers } from './pets.js';
import type { SimulationEvent, SimulationEventInput } from '../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../platform/gw2/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '../../../platform/gw2/combat/query/types.js';
import type { RangerSchedulerContext, RangerSkill } from '../types.js';
import type { RangerCastContext } from '../types.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export const rangerCoreSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'ranger.boon-companion-candidates',
    order: 5,
    // An unmerged active pet competes only after player recipients for shared boons.
    handler: (context: RangerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(
        event,
        professionCoreState(context).petActive ? [rangerPetCompanionId(context)] : []
      )
  },
  advance: {
    id: 'ranger.core-resources',
    order: 10,
    handler: advanceRangerResources
  },
  onCastStart: {
    id: 'ranger.pet-command',
    order: 10,
    handler: beginRangerPetCommand
  },
  onEventScheduled: {
    id: 'ranger.core-events',
    order: 10,
    handler(context: RangerSchedulerContext, event: SimulationEvent): void {
      observeRangerPetEvent(context, event);
    }
  },
  taskHandlers: rangerPetTaskHandlers,
  snapshot: (context: RangerSchedulerContext) => snapshotRangerState(context.state.profession),
  afterCast: {
    id: 'ranger.weapon-state',
    order: 10,
    handler: updateRangerWeaponState
  },
  onCastComplete(context: RangerCastContext, skill: RangerSkill): void {
    completeRangerTraits(context, skill);
  },
  // Weapon-swap traits extend the shared transition without reimplementing it.
  onWeaponSwap: applyRangerWeaponSwapTraits
});

/** Runs Core Ranger mechanics owned by one completed skill activation. */
export const rangerCoreSkillMechanicHandlers = Object.freeze({
  'ranger.core.sync-path-of-scars-cooldown': ({
    context,
    skill,
    at
  }: {
    context: RangerSchedulerContext;
    skill: RangerSkill;
    at: number;
  }): void => {
    const readyAt = Number(context.state.cooldowns.get(skill.id) || at);
    context.state.cooldowns.set(ID.PATH_OF_SCARS, readyAt);
    context.state.cooldowns.set(ID.PATH_OF_SCARS_MAX_RANGE, readyAt);
  }
});

function petEvent(context: Gw2ModifierContext): boolean {
  // Pet modifiers require both canonical summon classification and Ranger-specific source ownership.
  return gw2EventActorType(context.event) === GW2_EVENT_ACTOR_TYPES.SUMMON && context.event?.source === 'ranger-pet';
}

// Count distinct configured or live target conditions at query time for traits
// that scale from condition variety rather than stack count.
function targetConditionCount(context: Gw2ModifierContext): number {
  const active = new Set(
    Object.entries(context.config?.target?.conditions || {})
      .filter(([, value]) => value === true || Number(value) > 0)
      .map(([condition]) => condition)
  );
  const runtime = context.runtime as
    | {
        conditionState?: Map<string, { stacks?: readonly { expiresAt?: number }[] }>;
      }
    | undefined;
  for (const [condition, entry] of runtime?.conditionState || []) {
    if ((entry.stacks || []).some((stack) => Number(stack.expiresAt) > context.time)) {
      active.add(condition);
    }
  }

  return active.size;
}

function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

// Query boon state for the active companion, honoring summon-audience events
// before falling back to configured assumptions.
function petBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.timeline?.buffStacksAt(boon, context.time, 0, 25, 'summon')) {
    return true;
  }

  if (
    context.config?.sharePlayerBoonsWithSummons !== false &&
    context.timeline?.buffStacksAt(boon, context.time, 0, 25, 'all')
  ) {
    return true;
  }

  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      (application.affectsSummons === true ||
        (context.config?.sharePlayerBoonsWithSummons !== false && application.affectsSelf !== false)) &&
      application.at <= context.time &&
      application.expiresAt > context.time
  );
}

function activeBoonCount(context: Gw2ModifierContext, audience: 'player' | 'pet'): number {
  return GW2_STANDARD_BOONS.filter((boon) =>
    audience === 'pet' ? petBoonActive(context, boon) : boonActive(context, boon)
  ).length;
}

function activePrimaryWeapon(context: Gw2ModifierContext): string {
  return Number(context.runtime?.activeWeaponSet) === 2
    ? String(context.config?.weaponSet2Primary || '')
    : String(context.config?.primaryWeapon || '');
}

function weaponSetIncludes(context: Gw2ModifierContext, weaponSet: number, names: readonly string[]): boolean {
  const weapons =
    weaponSet === 2
      ? [context.config?.weaponSet2Primary, context.config?.weaponSet2Secondary]
      : [context.config?.primaryWeapon, context.config?.secondaryWeapon];
  return weapons.some((weapon) => names.includes(String(weapon || '')));
}

// Keeps Ranger-specific skill typing while using the shared modifier-context lookup precedence.
const eventSkill = (context: Gw2ModifierContext): RangerSkill | undefined => gw2EventSkill<RangerSkill>(context);

function openingStrikeReady(context: Gw2ModifierContext): boolean {
  const core = (
    context.runtime as
      | {
          profession?: {
            core?: {
              playerOpeningStrikeReady?: boolean;
              petOpeningStrikeReady?: boolean;
            };
          };
        }
      | undefined
  )?.profession?.core;
  return petEvent(context)
    ? core?.petOpeningStrikeReady === true
    : isGw2PlayerModifierEligibleEvent(context.event) && core?.playerOpeningStrikeReady === true;
}

function activePetFamily(context: Gw2ModifierContext): string {
  const activePet = (context.runtime as { profession?: { core?: { activePet?: string } } } | undefined)?.profession
    ?.core?.activePet;
  return rangerPetByName(String(activePet || context.config?.selectedPet || 'Pig')).family;
}

function modifyRangerAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const calculatedWeapon = String(context.config?.attributeProvenance?.calculatedPrimaryWeapon || '');
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const adjust = (attribute: keyof Gw2ResolvedStats, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  if (petEvent(context) && hasTrait(context, TRAIT.FANG_AND_CLAW)) {
    const family = activePetFamily(context);
    if (['feline', 'avian', 'drake'].includes(family)) {
      adjust('precision', rangerBalanceValue(context, PROFILE.fangAndClaw, 'attributeBonus', 420));
      adjust('ferocity', rangerBalanceValue(context, PROFILE.fangAndClaw, 'weaponAttributeBonus', 450));
    }
  }

  if (petEvent(context) && hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
    const family = activePetFamily(context);
    if (['spider', 'devourer'].includes(family)) {
      adjust('expertise', rangerBalanceValue(context, PROFILE.arachnophobia, 'weaponAttributeBonus', 225));
    }
  }

  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
      const bonus = rangerBalanceValue(context, PROFILE.stridersStrength, 'attributeBonus', 120);
      adjust('power', bonus + (activePrimaryWeapon(context) === 'Sword' ? bonus : 0));
    }

    if (hasTrait(context, TRAIT.HONED_AXES)) {
      const bonus = rangerBalanceValue(context, PROFILE.honedAxes, 'attributeBonus', 120);
      adjust(
        'ferocity',
        bonus + (weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Axe']) ? bonus : 0)
      );
    }

    if (hasTrait(context, TRAIT.VICIOUS_QUARRY) && boonActive(context, 'fury')) {
      adjust('ferocity', rangerBalanceValue(context, PROFILE.viciousQuarry, 'attributeBonus', 250));
    }

    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      adjust('expertise', rangerBalanceValue(context, PROFILE.arachnophobia, 'attributeBonus', 150));
    }

    if (hasTrait(context, TRAIT.LINGERING_MAGIC)) {
      adjust('concentration', rangerBalanceValue(context, PROFILE.lingeringMagic, 'attributeBonus', 240));
    }

    if (hasTrait(context, TRAIT.AMBIDEXTERITY)) {
      const bonus = rangerBalanceValue(context, PROFILE.ambidexterity, 'attributeBonus', 120);
      adjust(
        'conditionDamage',
        weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Dagger', 'Mace', 'Torch'])
          ? bonus * 2
          : bonus
      );
    }

    if (hasTrait(context, TRAIT.WELLSPRING) && !petEvent(context)) {
      // Convert gear-only power (config.stats), not the live power
      // that already includes might and Strider's Strength.
      adjust(
        'healingPower',
        Number(context.config?.stats?.power || 0) *
          rangerBalanceValue(context, PROFILE.wellspring, 'attributeConversion', 0.07)
      );
    }
  }

  if (staticRulesApplied && !petEvent(context) && hasTrait(context, TRAIT.HONED_AXES)) {
    const bonus = rangerBalanceValue(context, PROFILE.honedAxes, 'attributeBonus', 120);
    const activeHasAxe = weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Axe']);
    const calculatedHasAxe = weaponSetIncludes(context, calculatedWeaponSet, ['Axe']);
    adjust('ferocity', bonus * (1 + Number(activeHasAxe)) - 120 * (1 + Number(calculatedHasAxe)));
  }

  if (staticRulesApplied && !petEvent(context) && hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
    const bonus = rangerBalanceValue(context, PROFILE.stridersStrength, 'attributeBonus', 120);
    adjust(
      'power',
      bonus * (1 + Number(activePrimaryWeapon(context) === 'Sword')) - 120 * (1 + Number(calculatedWeapon === 'Sword'))
    );
  }

  if (staticRulesApplied && !petEvent(context) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
    const bonus = rangerBalanceValue(context, PROFILE.ambidexterity, 'attributeBonus', 120);
    const favored = ['Dagger', 'Mace', 'Torch'];
    const active = weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), favored);
    const calculated = weaponSetIncludes(context, calculatedWeaponSet, favored);
    adjust('conditionDamage', bonus * (1 + Number(active)) - 120 * (1 + Number(calculated)));
  }

  if (staticRulesApplied && !petEvent(context)) {
    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      adjust('expertise', rangerBalanceValue(context, PROFILE.arachnophobia, 'attributeBonus', 150) - 150);
    }

    if (hasTrait(context, TRAIT.LINGERING_MAGIC)) {
      adjust('concentration', rangerBalanceValue(context, PROFILE.lingeringMagic, 'attributeBonus', 240) - 240);
    }

    if (hasTrait(context, TRAIT.WELLSPRING)) {
      adjust(
        'healingPower',
        Number(context.config?.stats?.power || 0) *
          (rangerBalanceValue(context, PROFILE.wellspring, 'attributeConversion', 0.07) - 0.07)
      );
    }

    if (hasTrait(context, TRAIT.VICIOUS_QUARRY)) {
      const configuredFury = Boolean(context.config?.boons?.fury);
      const activeFury = boonActive(context, 'fury');
      adjust(
        'ferocity',
        Number(activeFury) * rangerBalanceValue(context, PROFILE.viciousQuarry, 'attributeBonus', 250) -
          Number(configuredFury) * 250
      );
    }
  }

  if (petEvent(context) && hasTrait(context, TRAIT.WELLSPRING)) {
    const conversion = rangerBalanceValue(context, PROFILE.wellspring, 'attributeConversion', 0.07);
    if (staticRulesApplied) {
      adjust('healingPower', -Number(context.config?.stats?.power || 0) * 0.07);
    }

    const summonBasePower = Number(context.event?.summonBasePower);
    const petPower =
      Number.isFinite(summonBasePower) && summonBasePower > 0
        ? summonBasePower +
          (context.query?.mightStacksAt(context.time, context.runtime || undefined, context.event || undefined) || 0) *
            30
        : Number(result.power || 0);
    adjust('healingPower', petPower * conversion);
  }

  if (hasSelectedSkill(context, 'Signet of the Wild')) {
    const active = !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_THE_WILD, context.time);
    const bonus = rangerBalanceValue(context, PROFILE.signetOfTheWild, 'attributeBonus', 180);
    if (staticRulesApplied) adjust('ferocity', active ? bonus - 180 : -180);
    if (!staticRulesApplied && active) adjust('ferocity', bonus);
  }

  return result;
}

// Apply skill-specific trap multipliers and positional projectile bonuses to the
// base condition duration before general Expertise scaling.
function modifyRangerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  let result = duration;
  const skill = eventSkill(context);
  if (skill?.categories?.includes('Trap') && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    return (
      duration *
      rangerBalanceValue(
        context,
        PROFILE.trappersExpertise,
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier',
        skill.id === ID.FLAME_TRAP ? 1.66 : 1.6
      )
    );
  }

  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && positional(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      return result + rangerBalanceValue(context, PROFILE.lightOnYourFeet, 'durationPerTier', 2);
    }

    if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      return result + rangerBalanceValue(context, PROFILE.lightOnYourFeet, 'durationPerTier', 2);
    }

    if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      return result + rangerBalanceValue(context, PROFILE.lightOnYourFeet, 'minimumStacks', 1);
    }
  }

  return result;
}

function positional(context: Gw2ModifierContext): boolean {
  // Defiant is the positional proxy: a defiant golem never rotates, so
  // flanking/behind bonuses always apply and need no separate control.
  return Boolean(context.config?.target?.defiant);
}

function targetImpaired(context: Gw2ModifierContext): boolean {
  if (context.config?.target?.defiant || context.config?.target?.disabled || context.config?.target?.defianceBroken) {
    return true;
  }

  return ['Chilled', 'Crippled', 'Immobilized', 'Taunt', 'Fear'].some((condition) =>
    targetConditionActive(context, condition)
  );
}

function targetVulnerable(context: Gw2ModifierContext): boolean {
  return Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) > 0;
}

export const rangerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => petEvent(context) && boonActive(context, 'sic-em-pet')
  },
  {
    id: 'ranger.lesser-sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => petEvent(context) && boonActive(context, 'lesser-sic-em-pet')
  },
  {
    id: 'ranger.hunters-tactics-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) && positional(context) && hasTrait(context, TRAIT.HUNTERS_TACTICS)
  },
  {
    id: 'ranger.hunters-tactics-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) && positional(context) && hasTrait(context, TRAIT.HUNTERS_TACTICS)
  },
  {
    id: 'ranger.light-on-your-feet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
      boonActive(context, 'light-on-your-feet')
  },
  {
    id: 'ranger.light-on-your-feet-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
      boonActive(context, 'light-on-your-feet')
  },
  {
    id: 'ranger.vicious-quarry-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => hasTrait(context, TRAIT.VICIOUS_QUARRY) && boonActive(context, 'fury')
  },
  {
    id: 'ranger.farsighted',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      eventSkill(context)?.type === 'Weapon' &&
      hasTrait(context, TRAIT.FARSIGHTED)
  },
  {
    id: 'ranger.bountiful-hunter-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + activeBoonCount(context, 'player') * parameters.damagePerBoon,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
  },
  {
    id: 'ranger.bountiful-hunter-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + activeBoonCount(context, 'pet') * parameters.damagePerBoon,
    when: (context) => petEvent(context) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
  },
  {
    id: 'ranger.wolfsong',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) && targetVulnerable(context) && hasTrait(context, TRAIT.WOLFSONG)
  },
  {
    id: 'ranger.remorseless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) => openingStrikeReady(context) && hasTrait(context, TRAIT.REMORSELESS)
  },
  {
    id: 'ranger.precise-strike',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) => openingStrikeReady(context) && hasTrait(context, TRAIT.PRECISE_STRIKE)
  },
  {
    id: 'ranger.predators-onslaught-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      targetImpaired(context) &&
      hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT)
  },
  {
    id: 'ranger.predators-onslaught-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) => petEvent(context) && targetImpaired(context) && hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT)
  },
  {
    id: 'ranger.hidden-barbs',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => context.condition === 'Bleeding' && hasTrait(context, TRAIT.HIDDEN_BARBS)
  },
  {
    id: 'ranger.poison-master',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      context.condition === 'Poisoned' &&
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.POISON_MASTER)
  },
  {
    id: 'ranger.survival-instincts',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.SURVIVAL_INSTINCTS)
  },
  {
    id: 'ranger.loud-whistle-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) => petEvent(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
  },
  {
    id: 'ranger.disabled-skill-bonus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      Boolean(
        String(context.event?.damageKind || '').startsWith('ranger-unleashed-disabled') &&
          (context.config?.target?.defiant ||
            context.config?.target?.disabled ||
            context.config?.target?.defianceBroken)
      )
  },
  {
    id: 'ranger.pounce-defiant',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      context.event?.damageKind === 'ranger-pounce-defiant' &&
      Boolean(
        context.config?.target?.defiant || context.config?.target?.disabled || context.config?.target?.defianceBroken
      )
  },
  {
    id: 'ranger.condition-count-skill-bonus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerCondition: 0.02 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + targetConditionCount(context) * parameters.damagePerCondition,
    when: (context) => context.event?.damageKind === 'ranger-unleashed-disabled-condition-count'
  },
  {
    id: 'ranger.consuming-bite-condition-count',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      maximumConditions: 5,
      coefficientPerCondition: 0.025
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const coefficient = Number(context.event?.coefficient || 0);
      if (!(coefficient > 0)) return 1;
      const conditions = Math.min(parameters.maximumConditions, targetConditionCount(context));
      return (coefficient + conditions * parameters.coefficientPerCondition) / coefficient;
    },
    when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.CONSUMING_BITE
  }
]);

export function compileRangerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

export const rangerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyRangerAttributes,
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules,
  compileModifierRules: compileRangerModifierRules
});

export const rangerCoreCastRules = Object.freeze({
  availability: {
    id: 'ranger.core-availability',
    order: 10,
    handler: rangerCoreCastAvailability
  },
  modifyRechargeDuration(context: RangerSchedulerContext & { skill?: RangerSkill }, duration: number): number {
    const skill = context.skill;
    let result = duration;
    const state = professionCoreState(context);
    if (
      skill?.type === 'Weapon' &&
      skill.slot !== 'Weapon_1' &&
      state.quickDrawUntil > context.state.time &&
      hasTrait(context, TRAIT.QUICK_DRAW)
    ) {
      result *= rangerBalanceValue(context, PROFILE.quickDraw, 'rechargeMultiplier', 0.34);
    }

    if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.HONED_AXES)) {
      result *= rangerBalanceValue(context, PROFILE.honedAxes, 'rechargeMultiplier', 0.8);
    }

    if (skill?.weapon === 'Shortbow' && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
      result *= rangerBalanceValue(context, PROFILE.lightOnYourFeet, 'rechargeMultiplier', 0.8);
    }

    if (['Dagger', 'Torch'].includes(String(skill?.weapon || '')) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
      result *= rangerBalanceValue(context, PROFILE.ambidexterity, 'rechargeMultiplier', 0.8);
    }

    if (skill?.petSkill && hasTrait(context, TRAIT.PACK_ALPHA)) {
      result *= rangerBalanceValue(context, PROFILE.packAlpha, 'rechargeMultiplier', 0.8);
    }

    return result;
  }
});
