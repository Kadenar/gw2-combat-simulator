import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { revenantRuntimeSpecializationState } from '#gw2/professions/revenant/core/modifiers.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { enduranceNotFull } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';

/** Owns Angsiyan's Trust tuning and behavior at its established execution boundaries. */
export const angsiyansTrust = defineTrait({
  id: TRAIT.ANGSIYANS_TRUST,
  name: "Angsiyan's Trust",
  balance: { resourceGain: 25, effects: [] }
});

/** Owns Empire Divided tuning and behavior at its established execution boundaries. */
export const empireDivided = defineTrait({
  buildAttributes: traitAttributeEffects(TRAIT.EMPIRE_DIVIDED, [
    { kind: 'flat', to: 'Power', field: 'attributeBonus', feedsConversions: false }
  ]),
  id: TRAIT.EMPIRE_DIVIDED,
  name: 'Empire Divided',
  balance: { attributeBonus: 240 }
});

/** Owns Forerunner of Death tuning and behavior at its established execution boundaries. */
export const forerunnerOfDeath = defineTrait({
  id: TRAIT.FORERUNNER_OF_DEATH,
  name: 'Forerunner of Death',
  balance: {
    effects: [
      {
        name: 'forerunner-of-death',
        type: 'buff',
        kind: 'forerunner-of-death',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.forerunner-of-death',
      order: 101,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // "damage-additive" goes into the GW2 shared outgoing-damage bucket alongside other % modifiers.
      operation: 'damage-additive',
      amount: 0.25,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Prefer the event-baked flag when present; fall back to runtime state for non-dodge strikes.
        (context.event?.forerunnerOfDeathActive != null
          ? Boolean(context.event.forerunnerOfDeathActive)
          : (revenantRuntimeSpecializationState(context, 'Vindicator').forerunnerOfDeathUntil || 0) > context.time)
    }
  ]
});

/** Owns Leviathan Strength tuning and behavior at its established execution boundaries. */
export const leviathanStrength = defineTrait({
  id: TRAIT.LEVIATHAN_STRENGTH,
  name: 'Leviathan Strength',
  modifierRules: [
    {
      id: 'revenant.leviathan-strength',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // "multiply" runs after the damage-additive bucket, so Leviathan compounds on top of Forerunner.
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && enduranceNotFull(context)
    }
  ]
});

/** Owns Reaver's Curse tuning and behavior at its established execution boundaries. */
export const reaversCurse = defineTrait({
  id: TRAIT.REAVERS_CURSE,
  name: "Reaver's Curse",
  balance: {
    rechargeMultiplier: 0.5,
    damageMultiplier: 2,
    effects: [
      {
        name: 'reavers-curse',
        type: 'buff',
        kind: 'reavers-curse',
        duration: 6,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => ENERGY_MELD_IDS.has(skill.id),
      multiplier: { profile: TRAIT.REAVERS_CURSE, field: 'rechargeMultiplier' }
    }
  ]
});

const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

/** Owns Saint of zu Heltzer tuning and behavior at its established execution boundaries. */
export const saintOfZuHeltzer = defineTrait({ id: TRAIT.SAINT_OF_ZU_HELTZER, name: 'Saint of zu Heltzer' });

/** Owns Song of Arboreum tuning and behavior at its established execution boundaries. */
export const songOfArboreum = defineTrait({
  id: TRAIT.SONG_OF_ARBOREUM,
  name: 'Song of Arboreum',
  balance: {
    resourceGain: 40,
    effects: [
      {
        name: 'vigor',
        type: 'boon',
        boon: 'vigor',
        duration: 9,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SONG_OF_ARBOREUM,
      on: 'castCommit',
      when: (_runtime, cast) => ENERGY_MELD_IDS.has(cast.skill.id),
      effects: (effect) => effect.type === 'boon' && effect.name === 'vigor',
      attribution: (_runtime, cast) => ({
        source: 'revenant',
        actorType: 'player',
        name: `${cast.skill.name} — vigor`
      })
    }
  ]
});

/** Owns Vassals of the Empire tuning and behavior at its established execution boundaries. */
export const vassalsOfTheEmpire = defineTrait({ id: TRAIT.VASSALS_OF_THE_EMPIRE, name: 'Vassals of the Empire' });

export const traitDefinitions = [
  songOfArboreum,
  reaversCurse,
  angsiyansTrust,
  empireDivided,
  forerunnerOfDeath,
  leviathanStrength,
  saintOfZuHeltzer,
  vassalsOfTheEmpire
];
