import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect,
  requireSkillFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type {
  AntiquaryStrike,
  ArtifactActivation
} from '#gw2/professions/thief/specializations/antiquary/mechanics/trigger-points.js';
import {
  antiquaryStruck,
  artifactActivated,
  artifactCompleted,
  artifactsPilfered,
  type ArtifactPilfer
} from '#gw2/professions/thief/specializations/antiquary/mechanics/trigger-points.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  METICULOUS_ARTIFACT_STRIKE_IDS,
  meticulousArtifactStrikeFactor
} from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefResolverContext } from '#gw2/professions/thief/types.js';

/**
 * Card Swap is the only source of Reshuffle, so the skill is denied whenever the trait is not selected. Its condition
 * removal on reshuffles and artifact use is outside the damage model and is intentionally not simulated.
 */
const cardSwap = defineTrait({
  name: 'Card Swap',
  id: TRAIT.CARD_SWAP,
  hooks: {
    availability: (runtime, skill) =>
      skill.id === ID.RESHUFFLE && !hasTrait(runtime, TRAIT.CARD_SWAP)
        ? denySkillCast(skill, 'thief.card-swap', 'requires the Card Swap trait.')
        : { ready: true }
  }
});

/** Owns Combat High tuning and behavior at the existing execution boundaries. */
const combatHigh = defineTrait({
  name: 'Combat High',
  id: TRAIT.COMBAT_HIGH,
  balance: {
    damageIncreasePerStack: 0.03,
    conditionDamageIncreasePerStack: 0.02,
    maximumStacks: 10,
    pulseInterval: 2,
    duration: 20
  },
  modifierRules: [
    {
      order: 401,
      id: 'thief.combat-high-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        activeStackCount(
          thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').combatHighExpirations || [],
          context.time
        ) * balanceNumberFromContext(context, TRAIT.COMBAT_HIGH, 'damageIncreasePerStack'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 402,
      id: 'thief.combat-high-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        activeStackCount(
          thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').combatHighExpirations || [],
          context.time
        ) * balanceNumberFromContext(context, TRAIT.COMBAT_HIGH, 'conditionDamageIncreasePerStack'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  triggers: [
    onTriggerPoint(artifactsPilfered, {
      when: (_runtime, { source }: ArtifactPilfer) => source === 'swipe',
      run: grantCombatHigh
    })
  ]
});

/** Owns Enterprising Aristocrat tuning and behavior at the existing execution boundaries. */
const enterprisingAristocrat = defineTrait({
  name: 'Enterprising Aristocrat',
  id: TRAIT.ENTERPRISING_ARISTOCRAT,
  balance: { resourceGain: 2 },
  triggers: [onTriggerPoint(artifactActivated, { run: applyEnterprisingAristocrat })]
});

/** Owns Exhilarating Ephemera tuning and behavior at the existing execution boundaries. */
const exhilaratingEphemera = defineTrait({
  name: 'Exhilarating Ephemera',
  id: TRAIT.EXHILARATING_EPHEMERA,
  balance: {
    damageIncrease: 0.1,
    durationExtension: 10,
    maximumStacks: 20
  },
  modifierRules: [
    {
      order: 400,
      id: 'thief.antiquary-artifact-momentum',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.EXHILARATING_EPHEMERA, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').antiquaryDamageUntil || 0) > context.time
    }
  ],
  triggers: [onTriggerPoint(artifactActivated, { run: applyExhilaratingEphemera })]
});

/** Owns Meticulous Custodian tuning and behavior at the existing execution boundaries. */
const meticulousCustodian = defineTrait({
  name: 'Meticulous Custodian',
  id: TRAIT.METICULOUS_CUSTODIAN,
  balance: {
    duration: 12,
    kryptisDuration: 10,
    mortarBurningDurationMultiplier: 2 / 1.5,
    sunCrystalBurningDurationMultiplier: 5 / 4,
    guitarFinalFactor: 3 / 2.5,
    guitarFactor: 1.2 / 0.8,
    mortarFactor: 0.6 / 0.5,
    chakFactor: 1,
    kryptisFactor: 3.36 / 2.8,
    holoFactor: 2.4 / 2,
    // Enhanced artifact packets remain part of the artifact's measured cast.
    kryptisTormentDurationMultiplier: 5 / 4,
    effects: [{ type: 'strike', name: 'Meticulous Custodian', coefficient: 0.3, hits: 1 }]
  },
  modifierRules: [
    {
      order: 404,
      id: 'thief.meticulous-custodian-artifact-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

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
      factor: (context) =>
        balanceNumberFromContext(context, TRAIT.METICULOUS_CUSTODIAN, 'mortarBurningDurationMultiplier'),
      when: (context) =>
        context.event?.skillId === ID.MISTBURN_MORTAR &&
        context.event.condition === CONDITION.BURNING &&
        context.event.triggeredBy == null // the Charged Strike bonus burn (applied by the landed strike) must not have its duration doubled a second time
    },
    {
      order: 406,
      id: 'thief.meticulous-custodian-sun-crystal-burning',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'multiply',
      factor: (context) =>
        balanceNumberFromContext(context, TRAIT.METICULOUS_CUSTODIAN, 'sunCrystalBurningDurationMultiplier'),
      when: (context) =>
        context.event?.skillId === ID.ZEPHYRITE_SUN_CRYSTAL &&
        context.event.condition === CONDITION.BURNING &&
        context.event.triggeredBy == null // only the base skill packet needs enhancement
    }
  ],
  triggers: [
    onTriggerPoint(artifactActivated, { run: applyMeticulousChakShield }),
    onTriggerPoint(antiquaryStruck, { run: applyMeticulousSunCrystal })
  ],
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (cast.skill.id !== ID.SUMMON_KRYPTIS_TURRET || !hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)) return effects;

      // Enhance the base Torment duration before expertise and its cap; this is not a duration-stat bonus.
      const multiplier = balanceNumberFromContext(
        runtime,
        TRAIT.METICULOUS_CUSTODIAN,
        'kryptisTormentDurationMultiplier'
      );
      return effects.map((effect) =>
        effect.type !== 'condition'
          ? effect
          : effect.ticks?.length
            ? {
                ...effect,
                ticks: effect.ticks.map((tick) =>
                  tick.condition === CONDITION.TORMENT ? { ...tick, duration: tick.duration * multiplier } : tick
                )
              }
            : effect.condition === CONDITION.TORMENT
              ? { ...effect, duration: Number(effect.duration) * multiplier }
              : effect
      );
    }
  }
});

/** Owns Possessive Hoarder tuning and behavior at the existing execution boundaries. */
const possessiveHoarder = defineTrait({
  name: 'Possessive Hoarder',
  id: TRAIT.POSSESSIVE_HOARDER,
  balance: {
    effects: [
      { type: 'boon', name: boonKey(BOON.MIGHT), boon: BOON.MIGHT, stacks: 10, duration: 12 },
      { type: 'boon', name: boonKey(BOON.PROTECTION), boon: BOON.PROTECTION, stacks: 1, duration: 5 },
      { type: 'boon', name: boonKey(BOON.ALACRITY), boon: BOON.ALACRITY, stacks: 1, duration: 5 }
    ]
  },
  triggers: [onTriggerPoint(artifactActivated, { run: applyPossessiveHoarder })]
});

/** Owns Prodigious Pincher tuning and behavior at the existing execution boundaries. */
const prodigiousPincher = defineTrait({
  name: 'Prodigious Pincher',
  id: TRAIT.PRODIGIOUS_PINCHER,
  balance: {
    threshold: 15
  }
});

/** Owns Prolific Plunderer tuning and behavior at the existing execution boundaries. */
const prolificPlunderer = defineTrait({
  name: 'Prolific Plunderer',
  id: TRAIT.PROLIFIC_PLUNDERER,
  balance: { resourceGain: 1 }
});

/** Owns Repeat Ransacker tuning and behavior at the existing execution boundaries. */
const repeatRansacker = defineTrait({
  name: 'Repeat Ransacker',
  id: TRAIT.REPEAT_RANSACKER,
  balance: {
    rechargeReduction: 2
  },
  triggers: [onTriggerPoint(artifactCompleted, { run: applyRepeatRansacker })]
});

/** Owns Scoundrel's Luck tuning and behavior at the existing execution boundaries. */
const scoundrelsLuck = defineTrait({
  name: "Scoundrel's Luck",
  id: TRAIT.SCOUNDRELS_LUCK,
  balance: {
    maximumStacks: 1,
    internalCooldown: 20
  },
  triggers: [
    onTriggerPoint(artifactsPilfered, {
      when: (_runtime, { source }: ArtifactPilfer) => source === 'swipe',
      run: grantScoundrelsLuck
    })
  ]
});

/** Native trait owners, in stable authoring order. */
// Intrinsic specialization policy is available without explicit minor selection.
const trinketCollector = defineTrait({
  name: 'Trinket Collector',
  id: TRAIT.TRINKET_COLLECTOR,
  balance: { maximumStacks: 1 }
});

export const antiquaryTraits = Object.freeze([
  trinketCollector,
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

/** Combat High replaces its stacks with canonical staggered expiries, losing one stack per interval. */
function grantCombatHigh(runtime: ThiefRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.COMBAT_HIGH);
  const maximum = Math.max(0, Math.trunc(balanceProfileNumber(profile, 'maximumStacks')));
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = runtime.time + balanceProfileNumber(profile, 'duration');
  antiquaryState.from(runtime).combatHighExpirations =
    interval > 0
      ? purgeExpiredStacks(
          Array.from({ length: maximum }, (_, index) => canonicalTime(expiresAt - index * interval)),
          runtime.time
        )
      : [];
}

/** Applies enterprising aristocrat at the original artifact boundary. */
function applyEnterprisingAristocrat(runtime: ThiefRuntime): void {
  const initiativeGain = balanceNumberFromContext(runtime, TRAIT.ENTERPRISING_ARISTOCRAT, 'resourceGain');

  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

/** Applies exhilarating ephemera at the original artifact boundary. */
function applyExhilaratingEphemera(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXHILARATING_EPHEMERA);
  const remaining = Math.max(0, (state.antiquaryDamageUntil || 0) - runtime.time);
  state.antiquaryDamageUntil =
    runtime.time +
    Math.min(
      balanceProfileNumber(profile, 'maximumStacks'),
      remaining + balanceProfileNumber(profile, 'durationExtension')
    );
}

/** Possessive Hoarder shares the artifact family's boon and Alacrity with the caster's five-player party. */
function applyPossessiveHoarder(runtime: ThiefRuntime, { cast, slot }: ArtifactActivation): void {
  // Artifact family chooses its boon, then Alacrity; each selected component remains independently removable.
  const names = [
    ...(slot?.kind === 'offensive' ? [boonKey(BOON.MIGHT)] : []),
    ...(slot?.kind === 'defensive' ? [boonKey(BOON.PROTECTION)] : []),
    boonKey(BOON.ALACRITY)
  ];
  for (const name of names)
    emitTraitProfile(runtime, TRAIT.POSSESSIVE_HOARDER, TRAIT.POSSESSIVE_HOARDER, undefined, {
      at: runtime.time,
      activationId: cast.id,
      effect: { type: 'boon', name },
      attribution: {
        source: 'thief',
        sourceId: 'Possessive Hoarder',
        actorType: ACTOR.PLAYER,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        name: 'Possessive Hoarder',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      transform: (packet) => ({ ...packet, boon: packet.kind, fixedDuration: false })
    });
}

/** Repeat Ransacker follows the artifact identity grant. */
function applyRepeatRansacker(runtime: ThiefRuntime): void {
  const swipe = runtime.helpers.skillsById.get(ID.SKRITT_SWIPE);

  if (swipe)
    runtime.cooldownController.reduceSkillRecharge(
      swipe,
      balanceNumberFromContext(runtime, TRAIT.REPEAT_RANSACKER, 'rechargeReduction'),
      runtime.time
    );
}

/** Scoundrel's Luck refreshes to its cap only when its internal cooldown is ready, so charges never bank. */
function grantScoundrelsLuck(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);

  if (!runtime.procs.claim(TRAIT.SCOUNDRELS_LUCK, 'thief.antiquary.scoundrelsLuck', runtime.time)) return;

  state.scoundrelsLuck = balanceNumberFromContext(runtime, TRAIT.SCOUNDRELS_LUCK, 'maximumStacks');
}

/** Applies meticulous custodian at the original artifact boundary. */
function applyMeticulousChakShield(runtime: ThiefRuntime, { cast }: ArtifactActivation): void {
  // Only this committed artifact receives the strike component, under its own skill identity.
  if (cast.skill.id !== ID.CHAK_SHIELD) return;

  emitTraitProfile(runtime, TRAIT.METICULOUS_CUSTODIAN, TRAIT.METICULOUS_CUSTODIAN, undefined, {
    at: runtime.time,
    activationId: cast.id,
    effect: { type: 'strike', name: 'Meticulous Custodian' },
    attribution: {
      source: 'thief',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: 'Chak Shield'
    }
  });
}

// Add Meticulous Custodian's Burning only to the Sun Crystal strike packet,
// excluding its declarative condition-only packets.
function applyMeticulousSunCrystal(context: ThiefResolverContext, { cause: event }: AntiquaryStrike): void {
  if (
    event.actorType !== ACTOR.PLAYER ||
    event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL ||
    event.coefficient == null // condition-only packets have no coefficient; burning fires on the strike hit
  )
    return;

  const sunCrystalMeticulousProfile = requireSkillFromContext(context, ID.ZEPHYRITE_SUN_CRYSTAL);
  const burning = requireEffect(sunCrystalMeticulousProfile, 'condition', 'Meticulous Burning');

  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;

  context.effects.emit({
    kind: 'profile',
    profile: sunCrystalMeticulousProfile,
    transform: (packet) => ({ ...packet, name: 'Zephyrite Sun Crystal - Meticulous Burning' }),
    effects: [burning],
    at: event.at,
    settlement: 'reaction',
    attribution: {
      source: 'thief',
      sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
      actorType: ACTOR.PLAYER,
      skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
      skillName: 'Zephyrite Sun Crystal',
      triggeredBy: event.skillName
    }
  });
}
