import { WEAPON, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { petDerivedConditionMetadata } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import {
  beastSkillUsed,
  buffApplied,
  openingStrikeConsumed,
  petSwapped,
  strike
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import {
  isPetStrike,
  isPlayerStrike,
  targetHealthFraction
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import { rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import { rangerPetEvent, rangerTargetImpaired } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

function openingStrikeReady(context: Gw2ModifierContext): boolean {
  const core = readProfessionCoreState<RangerCoreState>(context.runtime?.profession);
  const actor = rangerPetEvent(context)
    ? rangerOwningPetState(core.pet ?? null, context.event?.summonOwner)
    : isGw2PlayerModifierOwnedEvent(context.event)
      ? core.player
      : null;
  return actor?.openingStrikeReady === true;
}

function targetVulnerable(context: Gw2ModifierContext): boolean {
  return (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) > 0;
}

/** Owns Wolfsong's live tuning and trait behavior. */
export const wolfsong = defineTrait({
  triggers: [
    onTriggerPoint(beastSkillUsed, {
      run: (runtime, input: TriggerPointInput<typeof beastSkillUsed>) => applyWolfsong(runtime, input.skill)
    })
  ],
  id: TRAIT.WOLFSONG,
  name: 'Wolfsong',
  balance: {
    damageMultiplier: 1.1,
    effects: [
      {
        name: CONDITION.VULNERABILITY,
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 6,
        stacks: 6
      }
    ]
  },
  modifierRules: [
    {
      order: 8,
      id: 'ranger.wolfsong',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.WOLFSONG, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetVulnerable(context)
    }
  ]
});

/** Owns Clarion Bond's live tuning and trait behavior. */
export const clarionBond = defineTrait({
  triggers: [
    onTriggerPoint(petSwapped, {
      run: (runtime, input: TriggerPointInput<typeof petSwapped>) => applyClarionBond(runtime, input.skill)
    })
  ],
  id: TRAIT.CLARION_BOND,
  name: 'Clarion Bond'
});

/** Owns Opening Strike's live tuning and trait behavior. */
export const openingStrike = defineTrait({
  triggers: [
    onTriggerPoint(strike, {
      run: (runtime, input: TriggerPointInput<typeof strike>) => consumeOpeningStrike(runtime, input.event)
    })
  ],
  id: TRAIT.OPENING_STRIKE,
  name: 'Opening Strike',
  balance: {
    effects: [
      {
        name: CONDITION.VULNERABILITY,
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 5,
        stacks: 5
      }
    ]
  }
});

/** Owns Alpha Focus's live tuning and trait behavior. */
export const alphaFocus = defineTrait({
  triggers: [
    onTriggerPoint(openingStrikeConsumed, {
      run: (runtime, input: TriggerPointInput<typeof openingStrikeConsumed>) => applyAlphaFocus(runtime, input.event)
    })
  ],
  id: TRAIT.ALPHA_FOCUS,
  name: 'Alpha Focus',
  balance: {
    effects: [{ name: CONDITION.CRIPPLED, type: 'condition', condition: CONDITION.CRIPPLED, duration: 2, stacks: 1 }]
  }
});

/** Owns Hunter's Gaze's live tuning and trait behavior. */
export const huntersGaze = defineTrait({
  triggers: [
    onTriggerPoint(strike, {
      run: (runtime, input: TriggerPointInput<typeof strike>) => triggerHuntersGaze(runtime, input.event)
    })
  ],
  id: TRAIT.HUNTERS_GAZE,
  name: "Hunter's Gaze",
  balance: {
    lowerThreshold: 0.25,
    threshold: 0.5,
    upperThreshold: 0.75,
    internalCooldown: 1,
    maximumStacks: 3,
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 5, stacks: 1 }]
  }
});

/** Owns Lead the Wind's live tuning and trait behavior. */
export const leadTheWind = defineTrait({
  id: TRAIT.LEAD_THE_WIND,
  name: 'Lead the Wind',
  balance: {
    rechargeMultiplier: 0.8,
    effects: [
      { name: boonKey(BOON.SWIFTNESS), type: 'boon', boon: BOON.SWIFTNESS, duration: 10, stacks: 1 },
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 5, stacks: 1 }
    ]
  },
  triggers: [
    {
      order: 3,
      emit: TRAIT.LEAD_THE_WIND,
      on: 'castCommit' as const,
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) =>
        cast.skill.id === ID.POINT_BLANK_SHOT,
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.SWIFTNESS),
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
        skillId: TRAIT.LEAD_THE_WIND,
        skillName: 'Lead the Wind',
        name: `Lead the Wind - swiftness`,
        triggeredBy: cast.skill.name
      })
    },
    {
      order: 4,
      emit: TRAIT.LEAD_THE_WIND,
      on: 'castCommit' as const,
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) =>
        cast.skill.id === ID.POINT_BLANK_SHOT,
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.QUICKNESS),
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
        skillId: TRAIT.LEAD_THE_WIND,
        skillName: 'Lead the Wind',
        name: `Lead the Wind - quickness`,
        triggeredBy: cast.skill.name
      })
    }
  ],
  rechargeRules: [
    {
      order: 3,
      when: (_runtime, skill) => skill.weapon === WEAPON.LONGBOW,
      multiplier: { profile: TRAIT.LEAD_THE_WIND, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Precise Strike's live tuning and trait behavior. */
export const preciseStrike = defineTrait({
  id: TRAIT.PRECISE_STRIKE,
  name: 'Precise Strike',
  balance: {
    criticalChance: 1
  },
  modifierRules: [
    {
      order: 10,
      id: 'ranger.precise-strike',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.PRECISE_STRIKE, 'criticalChance'),
      when: (context) => openingStrikeReady(context)
    }
  ]
});

/** Owns Farsighted's live tuning and trait behavior. */
export const farsighted = defineTrait({
  id: TRAIT.FARSIGHTED,
  name: 'Farsighted',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      order: 6,
      id: 'ranger.farsighted',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.FARSIGHTED, 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.type === 'Weapon'
    }
  ]
});

/** Owns Remorseless's live tuning and trait behavior. */
export const remorseless = defineTrait({
  triggers: [
    onTriggerPoint(buffApplied, {
      run: (runtime, input: TriggerPointInput<typeof buffApplied>) => reactToRangerCoreBuff(runtime, input.event)
    })
  ],
  id: TRAIT.REMORSELESS,
  name: 'Remorseless',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.25 },
  modifierRules: [
    {
      order: 9,
      id: 'ranger.remorseless',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.REMORSELESS, 'damageMultiplier'),
      when: (context) => openingStrikeReady(context)
    }
  ]
});

/** Owns Predator's Onslaught's live tuning and trait behavior. */
export const predatorsOnslaught = defineTrait({
  id: TRAIT.PREDATORS_ONSLAUGHT,
  name: "Predator's Onslaught",
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      order: 11,
      id: 'ranger.predators-onslaught-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && rangerTargetImpaired(context)
    },
    {
      order: 33,
      id: 'ranger.predators-onslaught-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier'),
      when: (context) => rangerPetEvent(context) && rangerTargetImpaired(context)
    }
  ]
});

/** Completes the lesser warhorn package after the pet swap. */
function applyClarionBond(context: RangerRuntime, skill: RangerSkill): void {
  // A trait trigger invokes one independently patchable skill and shares that skill's recharge.
  const proc = context.helpers.skillsById.get(ID.LESSER_CALL_OF_THE_WILD)!;

  if (!proc.effects?.length || context.cooldownController.isOnCooldown(proc.id, context.time)) return;

  context.cooldownController.startRecharge(proc, context.time);
  invokeTraitSkill(context, TRAIT.CLARION_BOND, proc.id, {
    type: 'action',
    source: 'Trait',
    sourceId: proc.id,
    at: context.time,
    skillId: skill.id,
    skillName: skill.name,
    actorType: ACTOR.PLAYER
  });
}

/** Applies the trait at the accepted Beast-skill boundary. */
function applyWolfsong(context: RangerRuntime, skill: RangerSkill): void {
  if (rangerPetByName(professionCoreState(context).activePet).family === 'canine') {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WOLFSONG);
    const effect = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

    if (effect)
      emitTraitProfile(context, TRAIT.WOLFSONG, TRAIT.WOLFSONG, undefined, {
        at: context.time,
        fullEnd: context.time,
        effect: { type: 'condition', name: CONDITION.VULNERABILITY },
        attribution: {
          source: 'Trait',
          actorType: ACTOR.EFFECT,
          skillId: TRAIT.WOLFSONG,
          skillName: 'Wolfsong',
          name: 'Wolfsong - Vulnerability',
          triggeredBy: skill.name,
          sourceId: TRAIT.WOLFSONG
        }
      });
  }
}

// Spend the player or pet Opening Strike independently on its first qualifying
// hit and attach Vulnerability plus Alpha Focus when selected.
function consumeOpeningStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const player = isPlayerStrike(event);
  const pet = isPetStrike(event);

  if ((!player && !pet) || !(Number(event.coefficient) > 0)) return;

  const actor = player ? state.player : rangerOwningPetState(state.pet, event.summonOwner);

  if (!actor?.openingStrikeReady) return;

  const openingStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.OPENING_STRIKE);
  const openingStrike = requireEffect(openingStrikeProfile, 'condition', CONDITION.VULNERABILITY);
  const alphaFocusProfile = hasTrait(context, TRAIT.ALPHA_FOCUS)
    ? requireBalanceProfileFromContext(context, TRAIT.ALPHA_FOCUS)
    : undefined;
  const alphaFocus = alphaFocusProfile && requireEffect(alphaFocusProfile, 'condition', CONDITION.CRIPPLED);

  // Readiness is spent by a delivered opener; with every opener packet removed it stays armed.
  if (!openingStrike && !alphaFocus) return;

  actor.openingStrikeReady = false;

  if (openingStrike)
    emitTraitProfile(context, TRAIT.OPENING_STRIKE, TRAIT.OPENING_STRIKE, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.VULNERABILITY },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPENING_STRIKE,
        actorType: ACTOR.EFFECT,
        skillId: TRAIT.OPENING_STRIKE,
        skillName: 'Opening Strike',
        name: 'Opening Strike - Vulnerability',
        triggeredBy: event.skillName
      }
    });

  context.fireTrigger(openingStrikeConsumed, { event });
}

// Convert the target's current health tier into ICD-bound Might stacks on a
// qualifying player strike, using the resolver's cumulative damage state.
function triggerHuntersGaze(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event)) return;

  const health = targetHealthFraction(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.HUNTERS_GAZE);
  const might = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  // The cooldown and proc record exist only for the might packet.
  if (!might) return;

  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const stacks =
    health < balanceProfileNumber(profile, 'lowerThreshold')
      ? maximumStacks
      : health < balanceProfileNumber(profile, 'threshold')
        ? Math.max(0, maximumStacks - 1)
        : health < balanceProfileNumber(profile, 'upperThreshold')
          ? Math.max(0, maximumStacks - 2)
          : 0;

  // Target health must yield actual Might stacks before this hit claims the interval.
  if (!stacks || !context.procs.claim(TRAIT.HUNTERS_GAZE, 'ranger.core.huntersGaze', event.at)) return;

  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.HUNTERS_GAZE, actorType: ACTOR.EFFECT },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: "Hunter's Gaze",
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${stacks} might`,
      icon: context.helpers.skillsById.get(TRAIT.HUNTERS_GAZE)?.icon || ''
    }
  });
  emitTraitProfile(context, TRAIT.HUNTERS_GAZE, TRAIT.HUNTERS_GAZE, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: boonKey(BOON.MIGHT) },
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.HUNTERS_GAZE,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.HUNTERS_GAZE,
      skillName: "Hunter's Gaze",
      name: "Hunter's Gaze - Might",
      triggeredBy: event.skillName
    },
    transform: (packet) => ({ ...packet, stacks: stacks })
  });
}

function reactToRangerCoreBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();

  if (kind === boonKey(BOON.FURY) && event.resolvedAudience?.includesSelf) {
    const state = professionCoreState(context);
    state.player.openingStrikeReady = true;

    if (state.pet) state.pet.openingStrikeReady = true;
  }
}

/** The consumed opener grants Alpha Focus only through its selected owner. */
function applyAlphaFocus(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // A consumed pet opener retains its companion's attributes and lifetime identity.
  emitTraitProfile(context, TRAIT.ALPHA_FOCUS, TRAIT.ALPHA_FOCUS, undefined, {
    at: event.at,
    effect: { type: 'condition', name: CONDITION.CRIPPLED },
    attribution: {
      source: isPetStrike(event) ? 'ranger-pet' : 'Trait',
      actorType: isPetStrike(event) ? ACTOR.SUMMON : ACTOR.EFFECT,
      ownerActorType: isPetStrike(event) ? undefined : ACTOR.PLAYER,
      skillId: TRAIT.ALPHA_FOCUS,
      skillName: 'Alpha Focus',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      ...petDerivedConditionMetadata(context, event),
      name: 'Alpha Focus - ' + packet.condition
    })
  });
}
