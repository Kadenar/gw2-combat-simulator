import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumberFromContext, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  eliteLegendInvoked,
  invocationFervorGranted,
  legendInvoked
} from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { REVENANT_CORE_CALL_BY_LEGEND } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_ELITE_INVOCATIONS } from '#gw2/professions/revenant/data/legends.js';

/** Owns Charged Mists tuning and behavior at its established execution boundaries. */
export const chargedMists = defineTrait({
  name: 'Charged Mists',
  id: TRAIT.CHARGED_MISTS,
  balance: {
    resourceGain: 75,
    threshold: 10,
    effects: []
  }
});

/** Owns Ferocious Aggression tuning and behavior at its established execution boundaries. */
export const ferociousAggression = defineTrait({
  name: 'Ferocious Aggression',
  id: TRAIT.FEROCIOUS_AGGRESSION,
  balance: { damageIncrease: 0.1 },
  modifierRules: [
    {
      id: 'revenant.ferocious-aggression',
      order: 0,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.FEROCIOUS_AGGRESSION, 'damageIncrease'),
      // Grant the bonus only while permanent or simulated Fury affects the player.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, boonKey(BOON.FURY))
    }
  ]
});

/** Owns Incensed Response tuning and behavior at its established execution boundaries. */
export const incensedResponse = defineTrait({
  name: 'Incensed Response',
  id: TRAIT.INCENSED_RESPONSE,
  balance: {
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 5 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      when: (runtime, event) =>
        event.kind === boonKey(BOON.FURY) &&
        runtime.engagement.combatMechanicsAllowed() &&
        isGw2PlayerModifierOwnedEvent(event) &&
        gw2BoonApplicationRecipients(runtime.config, event).includesSelf,
      emit: TRAIT.INCENSED_RESPONSE,
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.MIGHT),
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.INCENSED_RESPONSE,
        actorType: ACTOR.PLAYER,
        skillId: TRAIT.INCENSED_RESPONSE,
        skillName: 'Incensed Response',
        name: undefined
      }
    }
  ]
});

/** Owns Invoker's Rage tuning and behavior at its established execution boundaries. */
export const invokersRage = defineTrait({
  name: "Invoker's Rage",
  id: TRAIT.INVOKERS_RAGE,
  balance: {
    effects: [{ type: 'boon', boon: BOON.FURY, duration: 5, stacks: 1 }]
  },
  triggers: [onTriggerPoint(legendInvoked, { run: invokeInvokersRage })]
});

/** Owns Rising Tide tuning and behavior at its established execution boundaries. */
export const risingTide = defineTrait({
  name: 'Rising Tide',
  id: TRAIT.RISING_TIDE,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1, threshold: 0.75 },
  modifierRules: [
    {
      id: 'revenant.rising-tide',
      order: 1,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.RISING_TIDE, 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        playerHealthFraction(context) > balanceNumberFromContext(context, TRAIT.RISING_TIDE, 'threshold')
    }
  ]
});

/** Owns Roiling Mists tuning and behavior at its established execution boundaries. */
export const roilingMists = defineTrait({
  name: 'Roiling Mists',
  id: TRAIT.ROILING_MISTS,
  balance: { criticalChance: 0.25 },
  // Fury supplies the additional chance only while this trait is selected.
  modifierRules: [
    {
      id: 'revenant.roiling-mists',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.ROILING_MISTS, 'criticalChance'),
      when: (context) => boonActive(context, boonKey(BOON.FURY))
    }
  ]
});

/** Owns Song of the Mists tuning and behavior at its established execution boundaries. */
export const songOfTheMists = defineTrait({
  name: 'Song of the Mists',
  id: TRAIT.SONG_OF_THE_MISTS,
  balance: { resourceGain: 2 },
  triggers: [
    onTriggerPoint(eliteLegendInvoked, {
      run(runtime) {
        grantRenegadeInvocationFervor(runtime);
        grantAllianceInvocationEndurance(runtime);
      }
    }),
    onTriggerPoint(legendInvoked, { run: invokeSongOfTheMists })
  ]
});

/** Owns Spirit Boon tuning and behavior at its established execution boundaries. */
export const spiritBoon = defineTrait({
  name: 'Spirit Boon',
  id: TRAIT.SPIRIT_BOON,
  balance: {
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 2,
        actorType: ACTOR.PLAYER,
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 2,
        stacks: 1,
        actorType: ACTOR.PLAYER,
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 1,
        actorType: ACTOR.PLAYER,
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1,
        actorType: ACTOR.PLAYER,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        metadata: { legendId: LEGEND.DRAGON },
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1,
        actorType: ACTOR.PLAYER
      },
      {
        metadata: { legendId: LEGEND.RENEGADE },
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 4,
        stacks: 1,
        actorType: ACTOR.PLAYER
      },
      {
        metadata: { legendId: LEGEND.ALLIANCE },
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 4,
        stacks: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [onTriggerPoint(legendInvoked, { run: invokeSpiritBoon })]
});

/** Runs the trait at its original ordered mechanic boundary. */
function invokeInvokersRage(runtime: RevenantRuntime): void {
  const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKERS_RAGE);
  emitTraitProfile(runtime, TRAIT.INVOKERS_RAGE, invocationProfile.id, undefined, {
    preserveName: true,
    effects: (effect) => (invocationProfile.effects ?? []).includes(effect),
    attribution: (effect) => ({
      activationId: `legend-invocation:${TRAIT.INVOKERS_RAGE}:${runtime.time}`,
      source: 'Trait',
      sourceId: TRAIT.INVOKERS_RAGE,
      actorType: effect.actorType || ACTOR.PLAYER,
      skillId: invocationProfile.id,
      skillName: invocationProfile.name
    }),
    skillWeaponFallback: 'Unequipped'
  });
}

/** Runs the trait at its original ordered mechanic boundary. */
function invokeSpiritBoon(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const matchesLegend = (effect: SkillEffect) => effect.metadata?.legendId === legendId;

  if (legendId) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.SPIRIT_BOON);
    emitTraitProfile(runtime, TRAIT.SPIRIT_BOON, invocationProfile.id, undefined, {
      preserveName: true,
      effects: (effect) => (invocationProfile.effects?.filter(matchesLegend) ?? []).includes(effect),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SPIRIT_BOON}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SPIRIT_BOON,
        actorType: effect.actorType || ACTOR.PLAYER,
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
function invokeSongOfTheMists(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;

  if (legendId) {
    // Calls share catalog mechanics while retaining the invocation trait as their triggering source.
    const song = runtime.helpers.skillsById.get(elite?.song ?? REVENANT_CORE_CALL_BY_LEGEND[legendId]);

    if (song)
      runtime.effects.emit({
        kind: 'profile',
        profile: song,
        cause: null,
        effects: song.effects ?? [],
        attribution: (effect) => ({
          activationId: `legend-invocation:${TRAIT.SONG_OF_THE_MISTS}:${runtime.time}`,
          source: 'revenant',
          sourceId: TRAIT.SONG_OF_THE_MISTS,
          actorType: effect.actorType || ACTOR.PLAYER,
          skillId: song.id,
          skillName: song.name
        }),
        skillWeaponFallback: 'Unequipped'
      });
  }
}

/** Core emits the invocation packets; Kalla additionally grants two Fervor stacks for Song of the Mists. */
function grantRenegadeInvocationFervor(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.RENEGADE || !runtime.engagement.combatMechanicsAllowed())
    return;

  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_RENEGADE);

  if (!song) return;

  for (let index = 0; index < balanceNumberFromContext(runtime, TRAIT.SONG_OF_THE_MISTS, 'resourceGain'); index += 1)
    runtime.fireTrigger(invocationFervorGranted, { sourceId: TRAIT.SONG_OF_THE_MISTS, sourceName: song.name });
}

/** Core emits the invocation packets; Alliance additionally restores the Song skill's authored endurance. */
function grantAllianceInvocationEndurance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !runtime.engagement.combatMechanicsAllowed())
    return;

  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);

  if (!song) return;

  runtime.endurance.grant(song.resourceGain || 0);
}
