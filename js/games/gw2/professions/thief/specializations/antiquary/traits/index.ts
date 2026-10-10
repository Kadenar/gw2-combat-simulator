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
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type {
  AntiquaryStrike,
  ArtifactActivation
} from '#gw2/professions/thief/specializations/antiquary/mechanics/boundaries.js';
import {
  antiquaryStruck,
  artifactActivated,
  artifactCompleted,
  artifactsPilfered,
  type ArtifactPilfer
} from '#gw2/professions/thief/specializations/antiquary/mechanics/boundaries.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
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
  triggers: [
    onTriggerPoint(artifactsPilfered, {
      when: (_runtime, { source }: ArtifactPilfer) => source === 'swipe',
      run: grantCombatHigh
    })
  ],
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
  triggers: [onTriggerPoint(artifactActivated, { run: applyEnterprisingAristocrat })],
  balance: { resourceGain: 2 }
});

/** Owns Exhilarating Ephemera tuning and behavior at the existing execution boundaries. */
export const exhilaratingEphemera = defineTrait({
  id: TRAIT.EXHILARATING_EPHEMERA,
  name: 'Exhilarating Ephemera',
  triggers: [onTriggerPoint(artifactActivated, { run: applyExhilaratingEphemera })],
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
  triggers: [
    onTriggerPoint(artifactActivated, { run: applyMeticulousChakShield }),
    onTriggerPoint(antiquaryStruck, { run: applyMeticulousSunCrystal })
  ],
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (cast.skill.id !== ID.SUMMON_KRYPTIS_TURRET || !hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)) return effects;
      // Enhance the base Torment duration before expertise and its cap; this is not a duration-stat bonus.
      const multiplier = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.METICULOUS_CUSTODIAN),
        'kryptisTormentDurationMultiplier'
      );
      return effects.map((effect) =>
        effect.type !== 'condition'
          ? effect
          : effect.ticks?.length
            ? {
                ...effect,
                ticks: effect.ticks.map((tick) =>
                  tick.condition === 'Torment' ? { ...tick, duration: tick.duration * multiplier } : tick
                )
              }
            : effect.condition === 'Torment'
              ? { ...effect, duration: Number(effect.duration) * multiplier }
              : effect
      );
    }
  },
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
      chakRefundMaximum: 4,
      rechargeMultiplier: 0.2,
      effects: []
    },
    {
      id: PROFILE.forgedSurferMeticulous,
      name: 'Forged Surfer Dash - Meticulous',
      profileKind: 'skill-variant',
      parentId: ID.FORGED_SURFER_DASH,
      durationMultiplier: 13,
      effects: [
        { type: 'strike', name: 'Dash', coefficient: 2.8, hits: 1 },
        // Meticulous replaces the dash burn with one eight-second stack before expertise.
        { type: 'condition', name: 'Dash', condition: 'Burning', stacks: 1, duration: 8 },
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
        // Meticulous grants 20% stronger turret and decoy strikes.
        kryptisFactor: 3.36 / 2.8,
        holoFactor: 2.4 / 2
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
    kryptisTormentDurationMultiplier: 5 / 4,
    effects: [{ type: 'strike', name: 'Meticulous Custodian', coefficient: 0.3, hits: 1 }]
  }
});

/** Owns Possessive Hoarder tuning and behavior at the existing execution boundaries. */
export const possessiveHoarder = defineTrait({
  id: TRAIT.POSSESSIVE_HOARDER,
  name: 'Possessive Hoarder',
  triggers: [onTriggerPoint(artifactActivated, { run: applyPossessiveHoarder })],
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
  triggers: [onTriggerPoint(artifactCompleted, { run: applyRepeatRansacker })],
  balance: {
    rechargeReduction: 2
  }
});

/** Owns Scoundrel's Luck tuning and behavior at the existing execution boundaries. */
export const scoundrelsLuck = defineTrait({
  id: TRAIT.SCOUNDRELS_LUCK,
  name: "Scoundrel's Luck",
  triggers: [
    onTriggerPoint(artifactsPilfered, {
      when: (_runtime, { source }: ArtifactPilfer) => source === 'swipe',
      run: grantScoundrelsLuck
    })
  ],
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

/** Combat High replaces its stacks with staggered expiries, losing one stack per interval. */
function grantCombatHigh(runtime: ThiefRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.COMBAT_HIGH);
  const maximum = Math.max(0, Math.trunc(balanceProfileNumber(profile, 'maximumStacks')));
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  antiquaryState.from(runtime).combatHighExpirations =
    interval > 0
      ? purgeExpiredStacks(
          Array.from({ length: maximum }, (_, index) => expiresAt - index * interval),
          runtime.time
        )
      : [];
}

/** Applies enterprising aristocrat at the original artifact boundary. */
function applyEnterprisingAristocrat(runtime: ThiefRuntime): void {
  const initiativeGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.ENTERPRISING_ARISTOCRAT),
    'resourceGain'
  );
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
      remaining + balanceProfileNumber(profile, 'durationMultiplier')
    );
}

/** Possessive Hoarder shares the artifact family's boon and Alacrity with the caster's five-player party. */
function applyPossessiveHoarder(runtime: ThiefRuntime, { cast, slot }: ArtifactActivation): void {
  // Artifact family chooses its boon, then Alacrity; each selected component remains independently removable.
  const names = [
    ...(slot?.kind === 'offensive' ? ['might'] : []),
    ...(slot?.kind === 'defensive' ? ['protection'] : []),
    'alacrity'
  ];
  for (const name of names)
    emitTraitProfile(runtime, TRAIT.POSSESSIVE_HOARDER, TRAIT.POSSESSIVE_HOARDER, undefined, {
      at: runtime.time,
      activationId: cast.id,
      effect: { type: 'boon', name },
      attribution: {
        source: 'thief',
        sourceId: 'Possessive Hoarder',
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        name: 'Possessive Hoarder',
        audience: { recipients: 'party', maximumRecipients: 5 }
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
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REPEAT_RANSACKER), 'rechargeReduction'),
      runtime.time
    );
}

/** Scoundrel's Luck refreshes to its cap only when its internal cooldown is ready, so charges never bank. */
function grantScoundrelsLuck(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  if (!runtime.procs.claim(TRAIT.SCOUNDRELS_LUCK, 'thief.antiquary.scoundrelsLuck', runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SCOUNDRELS_LUCK);
  state.scoundrelsLuck = balanceProfileNumber(profile, 'maximumStacks');
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
      actorType: 'player',
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
    event.actorType !== 'player' ||
    event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL ||
    event.coefficient == null // condition-only packets have no coefficient; burning fires on the strike hit
  )
    return;
  const sunCrystalMeticulousProfile = requireBalanceProfileFromContext(context, PROFILE.sunCrystalMeticulous);
  const burning = requireEffect(sunCrystalMeticulousProfile, 'condition', 'Burning');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;
  emitTraitProfile(context, PROFILE.sunCrystalMeticulous, PROFILE.sunCrystalMeticulous, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Burning' },
    settlement: 'reaction',
    attribution: {
      source: 'thief',
      sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
      actorType: 'player',
      skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
      skillName: 'Zephyrite Sun Crystal',
      name: 'Zephyrite Sun Crystal - Meticulous Burning',
      triggeredBy: event.skillName
    }
  });
}
