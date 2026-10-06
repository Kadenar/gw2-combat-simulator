import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  engineerMechModifierEvent,
  isEngineerMechCommand
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { overclockPassive } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import {
  BARRIER_ENGINE_TASK,
  startBarrierEngine,
  pulseBarrierEngine,
  channelBarrierAlacrity
} from '#gw2/professions/engineer/specializations/mechanist/traits/barrier.js';

/** Owns Jade Cannons command selection and existing trait behavior. */
export const jadeCannons = defineTrait({
  id: TRAIT.MECH_ARMS_JADE_CANNONS,
  name: 'Jade Cannons',
  balance: {
    criticalChance: 0.2,
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      id: 'engineer.jade-cannons-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',

      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_JADE_CANNONS), 'criticalChance'),
      when: (context) => engineerMechModifierEvent(context)
    }
  ]
});

/** Owns Rocket Punch command selection and existing trait behavior. */
export const mechFighter = defineTrait({
  id: TRAIT.MECH_FIGHTER,
  name: 'Rocket Punch',
  balance: {
    internalCooldown: 5,
    effects: []
  }
});

/** Owns Mech Arms: High-Impact Drivers command selection and existing trait behavior. */
export const highImpactDrivers = defineTrait({
  id: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
  name: 'Mech Arms: High-Impact Drivers',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 10, packetLabel: 'on qualifying mech strikes' }
    ]
  }
});

/** Owns Mech Arms: Single-Edge Cutters command selection and existing trait behavior. */
export const singleEdgeCutters = defineTrait({
  id: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
  name: 'Mech Arms: Single-Edge Cutters',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3, actorType: 'summon' }
    ]
  }
});

/** Owns Jade Dynamo command selection and existing trait behavior. */
export const jadeDynamo = defineTrait({
  id: TRAIT.MECH_CORE_JADE_DYNAMO,
  name: 'Jade Dynamo',
  balance: {
    rechargeMultiplier: 0.8,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 2.5 }]
  },
  triggers: [
    {
      on: 'castCommit',
      when: (_runtime, cast) => isEngineerMechCommand(cast.skill),
      emit: TRAIT.MECH_CORE_JADE_DYNAMO,
      effects: (effect) => effect.type === 'boon' && effect.name === 'quickness',
      attribution: { actorType: 'player', name: 'Jade Dynamo — quickness' }
    }
  ],
  rechargeRules: [
    {
      when: (_context, skill) => isEngineerMechCommand(skill),
      multiplier: { profile: TRAIT.MECH_CORE_JADE_DYNAMO, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Mech Core: J-Drive command selection and existing trait behavior. */
export const jDrive = defineTrait({
  id: TRAIT.MECH_CORE_J_DRIVE,
  name: 'Mech Core: J-Drive',
  balance: { rechargeMultiplier: 0.76, effects: [] },
  rechargeRules: [
    {
      when: overclockPassive,
      multiplier: { profile: TRAIT.MECH_CORE_J_DRIVE, field: 'rechargeMultiplier' }
    }
  ]
});

/** Barrier Engine supplies its command and a combat-only passive barrier independent of mech attacks. */
export const barrierEngine = defineTrait({
  id: TRAIT.MECH_CORE_BARRIER_ENGINE,
  name: 'Mech Core: Barrier Engine',
  balance: {
    interval: 3,
    effects: [
      {
        type: 'buff',
        name: 'barrier',
        kind: 'barrier',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  hooks: {
    initialize(runtime) {
      if (!runtime.combatStartPending) startBarrierEngine(runtime);
    },
    onCombatStart(runtime) {
      if (runtime.hasExplicitCombatStart) startBarrierEngine(runtime);
    },
    backgroundTasks: [BARRIER_ENGINE_TASK],
    tasks: { [BARRIER_ENGINE_TASK]: pulseBarrierEngine }
  }
});

/** Owns Mech Frame: Conductive Alloys command selection and existing trait behavior. */
export const conductiveAlloys = defineTrait({
  id: TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
  name: 'Mech Frame: Conductive Alloys'
});

/** Accepted player and mech barriers grant alacrity with one shared cooldown per recipient. */
export const channelingConduits = defineTrait({
  id: TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
  name: 'Mech Frame: Channeling Conduits',
  balance: {
    internalCooldown: 1,
    effects: [{ type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 1 }]
  },
  hooks: { reactions: { 'buff.applied': channelBarrierAlacrity } }
});

/** Owns Mech Frame: Variable Mass Distributor command selection and existing trait behavior. */
export const variableMassDistributor = defineTrait({
  id: TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
  name: 'Mech Frame: Variable Mass Distributor',
  modifierRules: [
    {
      requiresSelection: false,
      id: 'engineer.mech-base-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'criticalChance'),
      when: (context) =>
        engineerMechModifierEvent(context) && !hasTrait(context, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR)
    }
  ]
});

/** Registers mechanist traits in the established gameplay order. */
export const mechanistTraits = [
  variableMassDistributor,
  jadeCannons,
  mechFighter,
  highImpactDrivers,
  singleEdgeCutters,
  jadeDynamo,
  jDrive,
  barrierEngine,
  conductiveAlloys,
  channelingConduits
];
