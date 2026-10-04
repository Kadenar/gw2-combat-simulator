import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  METICULOUS_ARTIFACT_STRIKE_IDS,
  meticulousArtifactStrikeFactor
} from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';

/**
 * Card Swap is the only source of Reshuffle, so the skill is denied whenever the trait is not selected. Its condition
 * removal on reshuffles and artifact use is outside the damage model and is intentionally not simulated.
 */
export const cardSwap = defineTrait({
  id: TRAIT.CARD_SWAP,
  name: 'Card Swap',
  hooks: {
    availability: (runtime, skill) =>
      skill.id === ID.RESHUFFLE && !hasTrait(runtime, TRAIT.CARD_SWAP)
        ? denySkillCast(skill, 'thief.card-swap', 'requires the Card Swap trait.')
        : { ready: true }
  }
});

/** Owns Combat High tuning and behavior at the existing execution boundaries. */
export const combatHigh = defineTrait({
  id: TRAIT.COMBAT_HIGH,
  name: 'Combat High',
  modifierRules: [
    {
      order: 401,
      id: 'thief.combat-high-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        damagePerStack: 0.03
      },
      amount: (context, _target, parameters) =>
        activeStackCount(
          thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').combatHighExpirations || [],
          context.time
        ) * parameters.damagePerStack,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 402,
      id: 'thief.combat-high-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        damagePerStack: 0.02
      },
      amount: (context, _target, parameters) =>
        activeStackCount(
          thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').combatHighExpirations || [],
          context.time
        ) * parameters.damagePerStack,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    maximumStacks: 10,
    pulseInterval: 2,
    durationMultiplier: 20
  }
});

/** Owns Enterprising Aristocrat tuning and behavior at the existing execution boundaries. */
export const enterprisingAristocrat = defineTrait({
  id: TRAIT.ENTERPRISING_ARISTOCRAT,
  name: 'Enterprising Aristocrat',
  balance: { resourceGain: 2 }
});

/** Owns Exhilarating Ephemera tuning and behavior at the existing execution boundaries. */
export const exhilaratingEphemera = defineTrait({
  id: TRAIT.EXHILARATING_EPHEMERA,
  name: 'Exhilarating Ephemera',
  modifierRules: [
    {
      order: 400,
      id: 'thief.antiquary-artifact-momentum',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').antiquaryDamageUntil || 0) > context.time
    }
  ],
  balance: {
    durationMultiplier: 10,
    maximumStacks: 20
  }
});

/** Owns Meticulous Custodian tuning and behavior at the existing execution boundaries. */
export const meticulousCustodian = defineTrait({
  id: TRAIT.METICULOUS_CUSTODIAN,
  name: 'Meticulous Custodian',
  profiles: [
    {
      id: PROFILE.artifactWindows,
      name: 'Antiquary Artifact Windows',
      profileKind: 'mechanic',
      durationMultiplier: 10,
      maximumStacks: 12,
      minimumStacks: 8,
      threshold: 10,
      playerStacks: 5,
      resourceGain: 3,
      rechargeMultiplier: 0.2,
      effects: []
    },
    {
      id: PROFILE.forgedSurferMeticulous,
      name: 'Forged Surfer Dash - Meticulous',
      profileKind: 'skill-variant',
      parentId: ID.FORGED_SURFER_DASH,
      effects: [
        { type: 'strike', name: 'Dash', coefficient: 2.8, hits: 1 },
        { type: 'condition', name: 'Dash', condition: 'Burning', stacks: 2, duration: 12 },
        { type: 'strike', name: 'Bomb', coefficient: 1.4, hits: 1 },
        { type: 'condition', name: 'Bomb', condition: 'Burning', stacks: 1, duration: 4.5 }
      ]
    },
    {
      id: PROFILE.sunCrystalMeticulous,
      name: 'Zephyrite Sun Crystal - Meticulous',
      profileKind: 'skill-variant',
      parentId: ID.ZEPHYRITE_SUN_CRYSTAL,
      effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 5 }]
    }
  ],
  modifierRules: [
    {
      order: 404,
      id: 'thief.meticulous-custodian-artifact-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        guitarFinalFactor: 3 / 2.5,
        guitarFactor: 1.2 / 0.8,
        mortarFactor: 0.6 / 0.5,
        chakFactor: 1,
        kryptisFactor: 3.84 / 2.8,
        holoFactor: 3 / 2
      },
      factor: meticulousArtifactStrikeFactor,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        METICULOUS_ARTIFACT_STRIKE_IDS.has(Number(context.event?.skillId))
    },
    {
      order: 405,
      id: 'thief.meticulous-custodian-mortar-burning',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'multiply',
      factor: 2 / 1.5,
      when: (context) =>
        context.event?.skillId === ID.MISTBURN_MORTAR &&
        context.event.condition === 'Burning' &&
        context.event.triggeredBy == null // the Charged Strike bonus burn (applied by the landed strike) must not have its duration doubled a second time
    },
    {
      order: 406,
      id: 'thief.meticulous-custodian-sun-crystal-burning',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'multiply',
      factor: 5 / 4,
      when: (context) =>
        context.event?.skillId === ID.ZEPHYRITE_SUN_CRYSTAL &&
        context.event.condition === 'Burning' &&
        context.event.triggeredBy == null // only the base skill packet needs enhancement
    }
  ],
  balance: {
    // Enhanced artifact packets remain part of the artifact's measured cast.
    damagePreviewAttribution: 'skill',
    effects: [{ type: 'strike', name: 'Meticulous Custodian', coefficient: 0.3, hits: 1 }]
  }
});

/** Owns Possessive Hoarder tuning and behavior at the existing execution boundaries. */
export const possessiveHoarder = defineTrait({
  id: TRAIT.POSSESSIVE_HOARDER,
  name: 'Possessive Hoarder',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 10, duration: 12 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 5 },
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5 }
    ]
  }
});

/** Owns Prodigious Pincher tuning and behavior at the existing execution boundaries. */
export const prodigiousPincher = defineTrait({
  id: TRAIT.PRODIGIOUS_PINCHER,
  name: 'Prodigious Pincher',
  balance: {
    threshold: 15
  }
});

/** Owns Prolific Plunderer tuning and behavior at the existing execution boundaries. */
export const prolificPlunderer = defineTrait({
  id: TRAIT.PROLIFIC_PLUNDERER,
  name: 'Prolific Plunderer',
  balance: { resourceGain: 1 }
});

/** Owns Repeat Ransacker tuning and behavior at the existing execution boundaries. */
export const repeatRansacker = defineTrait({
  id: TRAIT.REPEAT_RANSACKER,
  name: 'Repeat Ransacker',
  balance: {
    rechargeReduction: 2
  }
});

/** Owns Scoundrel's Luck tuning and behavior at the existing execution boundaries. */
export const scoundrelsLuck = defineTrait({
  id: TRAIT.SCOUNDRELS_LUCK,
  name: "Scoundrel's Luck",
  balance: {
    maximumStacks: 1,
    internalCooldown: 20
  }
});

/** Native trait owners, in stable authoring order. */
export const antiquaryTraits = Object.freeze([
  repeatRansacker,
  scoundrelsLuck,
  combatHigh,
  prolificPlunderer,
  prodigiousPincher,
  enterprisingAristocrat,
  exhilaratingEphemera,
  possessiveHoarder,
  meticulousCustodian,
  cardSwap
]);
