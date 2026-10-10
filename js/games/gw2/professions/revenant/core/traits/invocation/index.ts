import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  eliteLegendInvoked,
  invocationFervorGranted,
  legendInvoked
} from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import { REVENANT_CORE_CALL_BY_LEGEND } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_ELITE_INVOCATIONS } from '#gw2/professions/revenant/family-state.js';

/** Owns Charged Mists tuning and behavior at its established execution boundaries. */
export const chargedMists = defineTrait({
  id: TRAIT.CHARGED_MISTS,
  name: 'Charged Mists',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 75,
    threshold: 10,
    effects: []
  }
});

/** Owns Ferocious Aggression tuning and behavior at its established execution boundaries. */
export const ferociousAggression = defineTrait({
  id: TRAIT.FEROCIOUS_AGGRESSION,
  name: 'Ferocious Aggression',
  balance: { damageIncrease: 0.1 },
  modifierRules: [
    {
      id: 'revenant.ferocious-aggression',
      order: 0,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_AGGRESSION), 'damageIncrease'),
      // Grant the bonus only while permanent or simulated Fury affects the player.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, 'fury')
    }
  ]
});

/** Owns Incensed Response tuning and behavior at its established execution boundaries. */
export const incensedResponse = defineTrait({
  id: TRAIT.INCENSED_RESPONSE,
  name: 'Incensed Response',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 5 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      when: (runtime, event) =>
        event.kind === 'fury' &&
        runtime.combatStartedAt() &&
        isGw2PlayerModifierOwnedEvent(event) &&
        gw2BoonApplicationRecipients(runtime.config, event).includesSelf,
      emit: TRAIT.INCENSED_RESPONSE,
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.INCENSED_RESPONSE,
        actorType: 'player',
        skillId: TRAIT.INCENSED_RESPONSE,
        skillName: 'Incensed Response',
        name: undefined
      }
    }
  ]
});

/** Owns Invoker's Rage tuning and behavior at its established execution boundaries. */
export const invokersRage = defineTrait({
  triggers: [onTriggerPoint(legendInvoked, { run: invokeInvokersRage })],
  id: TRAIT.INVOKERS_RAGE,
  name: "Invoker's Rage",
  balance: {
    effects: [{ type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  }
});

/** Owns Rising Tide tuning and behavior at its established execution boundaries. */
export const risingTide = defineTrait({
  id: TRAIT.RISING_TIDE,
  name: 'Rising Tide',
  modifierRules: [
    {
      id: 'revenant.rising-tide',
      order: 1,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > 0.75
    }
  ]
});

/** Owns Roiling Mists tuning and behavior at its established execution boundaries. */
export const roilingMists = defineTrait({
  id: TRAIT.ROILING_MISTS,
  name: 'Roiling Mists',
  balance: { criticalChance: 0.25 }
});

/** Owns Song of the Mists tuning and behavior at its established execution boundaries. */
export const songOfTheMists = defineTrait({
  triggers: [
    onTriggerPoint(eliteLegendInvoked, {
      run(runtime) {
        grantRenegadeInvocationFervor(runtime);
        grantAllianceInvocationEndurance(runtime);
      }
    }),
    onTriggerPoint(legendInvoked, { run: invokeSongOfTheMists })
  ],
  id: TRAIT.SONG_OF_THE_MISTS,
  name: 'Song of the Mists'
});

/** Owns Spirit Boon tuning and behavior at its established execution boundaries. */
export const spiritBoon = defineTrait({
  triggers: [onTriggerPoint(legendInvoked, { run: invokeSpiritBoon })],
  id: TRAIT.SPIRIT_BOON,
  name: 'Spirit Boon',
  profiles: [
    {
      id: TRAIT.SPIRIT_BOON,
      name: 'Spirit Boon (Core Legends)',
      profileKind: 'trait',

      categories: ['Trait'],
      skillFamily: 'Trait',
      effects: [
        {
          type: 'boon',
          boon: 'might',
          duration: 10,
          stacks: 2,
          actorType: 'player',
          metadata: { legendId: LEGEND.ASSASSIN }
        },
        {
          type: 'boon',
          boon: 'resistance',
          duration: 2,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.DEMON }
        },
        {
          type: 'boon',
          boon: 'stability',
          duration: 3,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.DWARF }
        },
        {
          type: 'boon',
          boon: 'regeneration',
          duration: 5,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.CENTAUR }
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.DRAGON].spiritBoon,
      name: 'Spirit Boon (Dragon)',
      profileKind: 'trait',

      description: 'Invoking Legendary Dragon grants protection to nearby allies.',
      icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
      effects: [
        {
          type: 'boon',
          boon: 'protection',
          duration: 3,
          stacks: 1,
          actorType: 'player'
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.RENEGADE].spiritBoon,
      name: 'Spirit Boon (Renegade)',
      profileKind: 'trait',

      description: 'Invoking Legendary Renegade grants resolution to nearby allies.',
      icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
      categories: ['Trait'],
      skillFamily: 'Trait',
      effects: [
        {
          type: 'boon',
          boon: 'resolution',
          duration: 4,
          stacks: 1,
          actorType: 'player'
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.ALLIANCE].spiritBoon,
      name: 'Spirit Boon (Alliance)',
      profileKind: 'trait',

      effects: [
        {
          type: 'boon',
          boon: 'vigor',
          duration: 4,
          stacks: 1,
          actorType: 'player'
        }
      ]
    }
  ]
});

/** Runs the trait at its original ordered mechanic boundary. */
function invokeInvokersRage(runtime: RevenantRuntime): void {
  {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKERS_RAGE);
    emitTraitProfile(runtime, TRAIT.INVOKERS_RAGE, invocationProfile.id, undefined, {
      preserveName: true,
      effects: (effect) => (invocationProfile.effects ?? []).includes(effect),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.INVOKERS_RAGE}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.INVOKERS_RAGE,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
function invokeSpiritBoon(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;
  const matchesLegend = (effect: SkillEffect) => elite != null || effect.metadata?.legendId === legendId;
  if (legendId) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, elite?.spiritBoon ?? TRAIT.SPIRIT_BOON);
    emitTraitProfile(runtime, TRAIT.SPIRIT_BOON, invocationProfile.id, undefined, {
      preserveName: true,
      effects: (effect) => (invocationProfile.effects?.filter(matchesLegend) ?? []).includes(effect),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SPIRIT_BOON}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SPIRIT_BOON,
        actorType: effect.actorType || 'player',
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
          actorType: effect.actorType || 'player',
          skillId: song.id,
          skillName: song.name
        }),
        skillWeaponFallback: 'Unequipped'
      });
  }
}

/** Core emits the invocation packets; Kalla additionally grants two Fervor stacks for Song of the Mists. */
function grantRenegadeInvocationFervor(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.RENEGADE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_RENEGADE);
  if (!song) return;
  for (let index = 0; index < 2; index += 1)
    runtime.fireTrigger(invocationFervorGranted, {
      sourceId: TRAIT.SONG_OF_THE_MISTS,
      sourceName: song.name,
      at: runtime.time
    });
}

/** Core emits the invocation packets; Alliance additionally restores the Song skill's authored endurance. */
function grantAllianceInvocationEndurance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);
  if (!song) return;
  runtime.endurance.grant(song.resourceGain || 0);
}
