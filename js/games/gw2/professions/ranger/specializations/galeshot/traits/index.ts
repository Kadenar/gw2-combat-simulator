import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

function galeshotRuntimeState(context: RangerModifierContext) {
  return readProfessionSpecializationState<{ windForce?: number; galeForceUntil?: number }>(
    context.runtime?.profession,
    'Galeshot'
  );
}

function windForce(context: RangerModifierContext): number {
  return galeshotRuntimeState(context)?.windForce || 0;
}

function galeForceAmount(context: RangerModifierContext, parameters: Readonly<Record<string, number>>): number {
  const galeForce = (galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time ? parameters.galeForceBonus : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return galeForce + windForce(context) * parameters.windForcePerStack;
}

function activePetIsFeathered(context: RangerModifierContext): boolean {
  const name =
    readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
    context.config?.selectedPet ||
    '';
  return ['avian', 'moa', 'phoenix', 'raptor swiftwing'].includes(rangerPetByName(name).family);
}

/** Owns Shrike's live tuning and trait behavior. */
export const shrike = defineTrait({
  id: TRAIT.SHRIKE,
  name: 'Shrike',
  balance: {
    threshold: 12,
    resourceGain: 1,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0.8,
        hits: 3,
        atMs: 0
      }
    ]
  }
});

/** Owns Wuthering Wind's live tuning and trait behavior. */
export const wutheringWind = defineTrait({
  id: TRAIT.WUTHERING_WIND,
  name: 'Wuthering Wind',
  balance: {
    effects: [{ name: 'Strike', type: 'strike', coefficient: 2, hits: 1 }]
  }
});

/** Owns Thrill of the Catch's live tuning and trait behavior. */
export const thrillOfTheCatch = defineTrait({
  id: TRAIT.THRILL_OF_THE_CATCH,
  name: 'Thrill of the Catch',
  balance: {
    internalCooldown: 0.25,
    resourceGain: 1
  }
});

/** Owns Flock Together's live tuning and trait behavior. */
export const flockTogether = defineTrait({
  id: TRAIT.FLOCK_TOGETHER,
  name: 'Flock Together',
  balance: {
    internalCooldown: 20,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 102,
      id: 'ranger.flock-together',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) =>
        context.event?.actorType === 'summon' && context.event.source === 'ranger-pet' && activePetIsFeathered(context)
    }
  ]
});

/** Owns Cloudburst's live tuning and trait behavior. */
export const cloudburst = defineTrait({
  id: TRAIT.CLOUDBURST,
  name: 'Cloudburst',
  balance: {
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 4, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 10, stacks: 4 },
      { name: 'Hawkeye quickness', type: 'boon', boon: 'quickness', duration: 8, stacks: 1 },
      { name: 'Hawkeye might', type: 'boon', boon: 'might', duration: 10, stacks: 8 }
    ]
  }
});

/** Owns Gale Force's live tuning and trait behavior. */
export const galeForce = defineTrait({
  id: TRAIT.GALE_FORCE,
  name: 'Gale Force',
  balance: {
    effects: [{ name: 'gale-force', type: 'buff', kind: 'gale-force', duration: 10, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.gale-force',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        galeForceBonus: 0.25,
        windForcePerStack: 0.03
      },
      amount: (context, _target, parameters) => galeForceAmount(context, parameters),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        ((galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time || windForce(context) > 0)
    }
  ]
});

/** Owns Bird of Prey's live tuning and trait behavior. */
export const birdOfPrey = defineTrait({
  id: TRAIT.BIRD_OF_PREY,
  name: 'Bird of Prey',
  modifierRules: [
    {
      order: 100,
      id: 'ranger.bird-of-prey',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      // Either movement buff activates the player bonus, including generated buffs until they expire.
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (boonActive(context, 'swiftness') || boonActive(context, 'superspeed'))
    }
  ]
});

/** Owns Perilous Skies's live tuning and trait behavior. */
export const perilousSkies = defineTrait({ id: TRAIT.PERILOUS_SKIES, name: 'Perilous Skies' });

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
export const galeshotTraits = [
  shrike,
  wutheringWind,
  thrillOfTheCatch,
  flockTogether,
  cloudburst,
  galeForce,
  birdOfPrey,
  perilousSkies
];
