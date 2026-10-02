import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { illusionSource, timedActive } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { hasLute } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import { completeTroubadourPhantasm } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';
import {
  observeSyncopateEvent,
  triggerMethodOfMadnessSyncopate
} from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';

/** Harmonize owns its existing profile and ordered performance consequences. */
export const harmonize = defineTrait<MesmerSkill>({
  id: TRAIT.HARMONIZE,
  name: 'Harmonize',
  balance: {
    resourceGain: 1
  },
  hooks: { onCastCommit: completeTroubadourPhantasm }
});

/** Mayhem owns its existing profile and ordered performance consequences. */
export const mayhem = defineTrait<MesmerSkill>({
  id: TRAIT.MAYHEM,
  name: 'Mayhem',
  balance: {
    rechargeReduction: 1.5,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 5, stacks: 4 }]
  },
  hooks: {
    tasks: {
      'mesmer.troubadour.dodge'(runtime, data) {
        const cast = (data as { cast: RuntimeCast<MesmerSkill> }).cast;
        const mechanics = mesmerMechanicsFor(runtime);
        if (!hasTrait(runtime, TRAIT.MAYHEM)) return;
        const flute = runtime.helpers.skillsById.get(ID.FLUSTERING_FLUTE);
        if (!flute || !runtime.cooldowns.has(flute.id)) return;
        runtime.cooldownController.reduceSkillRecharge(
          flute,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MAYHEM), 'rechargeReduction'),
          runtime.time
        );
        mechanics.addTraitProc('Mayhem', runtime.time, cast.skill.name);
      }
    }
  }
});

/** Raconteur owns its existing profile and ordered performance consequences. */
export const raconteur = defineTrait<MesmerSkill>({
  id: TRAIT.RACONTEUR,
  name: 'Raconteur',
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', duration: 3, stacks: 1 }]
  }
});

/** Shredding owns its existing profile and ordered performance consequences. */
export const shredding = defineTrait<MesmerSkill>({
  id: TRAIT.SHREDDING,
  name: 'Shredding',
  balance: {
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1, hits: 1, atMs: 600 }]
  },
  modifierRules: [
    {
      id: 'mesmer.shredding',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) => hasLute(context) && !illusionSource(context)
    }
  ]
});

/** Life of the Party owns its existing profile and ordered performance consequences. */
export const lifeOfTheParty = defineTrait<MesmerSkill>({
  id: TRAIT.LIFE_OF_THE_PARTY,
  name: 'Life of the Party',
  balance: {
    effects: [
      {
        type: 'boon',
        name: 'Lute Quickness',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Lute Might',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        name: 'Crescendo Quickness',
        boon: 'quickness',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Crescendo Might',
        boon: 'might',
        duration: 15,
        stacks: 8
      },
      {
        type: 'boon',
        name: 'Crescendo Fury',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  }
});

/** Fortissimo owns its existing profile and ordered performance consequences. */
export const fortissimo = defineTrait<MesmerSkill>({
  id: TRAIT.FORTISSIMO,
  name: 'Fortissimo',
  balance: {
    attributeConversion: 0.04,
    maximumStacks: 5,
    pulseInterval: 1,
    resourceGain: 1
  }
});

/** Call and Response owns its existing profile and ordered performance consequences. */
export const callAndResponse = defineTrait<MesmerSkill>({
  id: TRAIT.CALL_AND_RESPONSE,
  name: 'Call and Response',
  balance: {
    threshold: 3,
    initialDelay: 1.5
  }
});

/** Symphonic Resonance owns its existing profile and ordered performance consequences. */
export const symphonicResonance = defineTrait<MesmerSkill>({
  id: TRAIT.SYMPHONIC_RESONANCE,
  name: 'Symphonic Resonance',
  balance: { enduranceRegenerationMultiplier: 1.25 }
});

/** Altered Chord owns its existing profile and ordered performance consequences. */
export const alteredChord = defineTrait<MesmerSkill>({
  id: TRAIT.ALTERED_CHORD,
  name: 'Altered Chord',
  balance: {
    rechargeReduction: 2,
    durationMultiplier: 10,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 8, stacks: 5 }]
  },
  modifierRules: [
    {
      id: 'mesmer.altered-chord',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.25,
      when: (context) => timedActive(context, 'altered-chord') && !illusionSource(context)
    }
  ]
});

/** Register the control reaction and queued heal wave without changing their separate eligibility. */
export const syncopate = defineTrait<MesmerSkill>({
  id: TRAIT.SYNCOPATE,
  name: 'Syncopate',
  balance: {
    initialDelay: 3,
    effects: [
      { type: 'strike', name: 'Immediate wave', coefficient: 0.75, hits: 1 },
      { type: 'strike', name: 'Delayed wave', coefficient: 1, hits: 1 },
      { type: 'control', name: 'Delayed daze', controlKind: 'daze' }
    ]
  },
  hooks: {
    reactions: { 'control.resolved': observeSyncopateEvent },
    tasks: { 'mesmer.syncopate': triggerMethodOfMadnessSyncopate }
  }
});

/** Collect trait owners while instruments, notes, afterimage packets, and endurance remain shared mechanics. */
export const troubadourTraits = [
  harmonize,
  mayhem,
  raconteur,
  shredding,
  lifeOfTheParty,
  fortissimo,
  callAndResponse,
  symphonicResonance,
  alteredChord,
  syncopate
];
