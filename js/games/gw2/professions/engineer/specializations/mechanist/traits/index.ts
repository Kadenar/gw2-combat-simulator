import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mechStruck, type MechStrike } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  engineerMechModifierEvent,
  isEngineerMechCommand
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import {
  mechanistCastCompleted,
  mechanistCombatReady,
  type MechanistCastCompletion
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { MECHANIST_MECH_ATTACK_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/mech-attack-skills.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';

import { overclockPassive } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import type { EngineerResolverEvent, EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const BARRIER_ENGINE_TASK = 'engineer.barrier-engine';

/** Owns Jade Cannons command selection and existing trait behavior. */
export const jadeCannons = defineTrait({
  id: TRAIT.MECH_ARMS_JADE_CANNONS,
  name: 'Jade Cannons',
  balance: {
    criticalChance: 0.2,
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6 }]
  },
  triggers: [
    onTriggerPoint(mechStruck, {
      when: (_runtime, { cause }: MechStrike) => cause.mechBasicAttack === true,
      run: applyJadeCannonsVulnerability
    })
  ],
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
    // The mech uses this skill, so only Alacrity received by that companion accelerates its recharge.
    cooldownPolicy: 'summonRecharge',
    cooldown: MECHANIST_MECH_ATTACK_SKILL_MECHANICS[ID.ROCKET_PUNCH_MECH]!.cooldown,
    effects: []
  },
  // The minor is intrinsic to Mechanist and keeps its existing implicit eligibility.
  triggers: [onTriggerPoint(mechanistCastCompleted, { requiresSelection: false, run: triggerMechFighter })]
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
  },
  triggers: [onTriggerPoint(mechStruck, { run: applyHighImpactDrivers })]
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
  },
  triggers: [onTriggerPoint(mechStruck, { run: applySingleEdgeCutters })]
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
  // Startup is a selected producer; accepted renewal remains a background lifetime task.
  triggers: [onTriggerPoint(mechanistCombatReady, { run: startBarrierEngine })],
  lifetime: {
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
  // Only new barrier rewards are isolated; recipient-specific claims remain with the selected listener.
  triggers: [{ on: 'buff.applied', run: channelBarrierAlacrity }]
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

/** Each surviving arm reward reserves its independent interval before delivery; a removed effect claims nothing. */
function applySingleEdgeCutters(context: EngineerRuntime, { cause: event }: MechStrike): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS);
  const packet = requireEffect(profile, 'condition', 'Bleeding');
  if (!packet || !context.procs.claim(TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, 'singleEdgeCutters', event.at)) return;
  emitTraitProfile(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, undefined, {
    at: event.at,
    effect: { type: 'condition', name: 'Bleeding' },
    settlement: 'reaction',
    attribution: {
      source: 'engineer',
      sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      actorType: 'summon',
      skillId: undefined,
      activationId: undefined,
      skillName: 'Mech Arms: Single-Edge Cutters',
      triggeredBy: event.skillName,
      offTarget: event.offTarget,
      metadata: { engineerMech: true }
    },
    transform: (packet) => ({
      ...packet,
      applicationIndex: undefined,
      totalApplications: undefined,
      name: 'Mech Arms: Single-Edge Cutters' + ' \u2014 ' + packet.condition,
      stacks: Number(packet.stacks),
      duration: Number(packet.duration),
      summonOwner: event.summonOwner,
      independentConditionOwner: event.independentConditionOwner,
      summonInheritsAttributes: true
    })
  });

  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: {
      type: 'trait',
      name: 'Mech Arms: Single-Edge Cutters',
      at: event.at,
      sourceSkill: event.skillName,
      icon: ''
    }
  });
}

/** High-Impact Drivers grants Might on its own independent interval. */
function applyHighImpactDrivers(context: EngineerRuntime, { cause: event }: MechStrike): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS);
  const packet = requireEffect(profile, 'boon', 'might');
  if (!packet || !context.procs.claim(TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, 'highImpactDrivers', event.at)) return;
  emitTraitProfile(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, undefined, {
    at: event.at,
    effect: { type: 'boon', name: 'might' },
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      actorType: 'effect',
      skillId: undefined,
      activationId: undefined,
      skillName: 'Mech Arms: High-Impact Drivers',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      applicationIndex: undefined,
      totalApplications: undefined,
      name: 'Mech Arms: High-Impact Drivers',
      stacks: Number(packet.stacks),
      duration: packet.duration
    })
  });

  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: {
      type: 'trait',
      name: 'Mech Arms: High-Impact Drivers',
      at: event.at,
      sourceSkill: event.skillName,
      icon: ''
    }
  });
}

/** Jade Cannons basic attacks apply Vulnerability without an interval. */
function applyJadeCannonsVulnerability(context: EngineerRuntime, { cause: event }: MechStrike): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_JADE_CANNONS);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (vulnerability)
    emitTraitProfile(context, TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_ARMS_JADE_CANNONS, undefined, {
      at: event.at,
      effect: { type: 'condition', name: 'Vulnerability' },
      settlement: 'reaction',
      attribution: {
        source: 'engineer',
        sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
        actorType: 'summon',
        skillId: undefined,
        activationId: undefined,
        skillName: 'Mech Arms: Jade Cannons',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,
        metadata: { engineerMech: true }
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'Mech Arms: Jade Cannons' + ' \u2014 ' + packet.condition,
        stacks: Number(vulnerability.stacks),
        duration: Number(vulnerability.duration),
        summonOwner: event.summonOwner,
        independentConditionOwner: event.independentConditionOwner,
        summonInheritsAttributes: true
      })
    });
}

/** Invoke the canonical Rocket Punch payload with its own summon activation and trait attribution. */
function emitRocketPunch(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  // The trait invokes the skill payload with a separate summon activation and native weapon roll.
  const punch = context.helpers.skillsById.get(ID.ROCKET_PUNCH_MECH)!;
  context.effects.emit({
    kind: 'profile',
    profile: punch,
    at,
    skillWeaponFallback: 'Unequipped',
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.MECH_FIGHTER,
      actorType: 'summon',
      skillId: punch.id,
      skillName: punch.name,
      activationId: 'engineer.rocket-punch:' + at,
      triggeredBy: skill.name,
      metadata: { engineerMech: true }
    }
  });
}

/** Weapon slot three invokes Rocket Punch after command recovery, using the mech's own recharge. */
function triggerMechFighter(context: EngineerRuntime, { skill, at }: MechanistCastCompletion): void {
  const state = mechanistState.from(context);
  if (
    state.mech.active &&
    skill.type === 'Weapon' &&
    !skill.kitId &&
    skill.slot === 'Weapon_3' &&
    // Spear triggers the punch on Electric Artillery; placing Lightning Rod does not fire it or consume its cooldown.
    skill.id !== ID.LIGHTNING_ROD &&
    context.procs.claim(TRAIT.MECH_FIGHTER, 'rocketPunch', at, 'engineer.mech')
  ) {
    // The weapon requests the mech-owned skill even when its optional strike is removed.
    emitRocketPunch(context, skill, at);
  }
}

/** The passive starts in combat and runs independently of the mech's command lane. */
function startBarrierEngine(runtime: EngineerRuntime): void {
  const state = mechanistState.from(runtime);
  if (state.barrierEngineStarted || !state.mech.active) return;
  state.barrierEngineStarted = true;
  scheduleBarrierEngine(runtime);
}

/** Recurrence schedules its next grant without attempting to admit a new loop. */
function scheduleBarrierEngine(runtime: EngineerRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE);
  runtime.schedule(BARRIER_ENGINE_TASK, runtime.time + balanceProfileNumber(profile, 'interval'));
}

/** Each passive grant selects up to five recipients, with the mech behind players in recipient priority. */
function pulseBarrierEngine(runtime: EngineerRuntime): void {
  if (!hasTrait(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE) || !mechanistState.from(runtime).mech.active) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE);
  emitTraitProfile(runtime, profile.id, profile.id, undefined, {
    attribution: {
      source: 'Trait',
      sourceId: profile.id,
      skillName: profile.name,
      actorType: 'summon',
      metadata: { engineerMech: true }
    },
    preserveName: true
  });
  scheduleBarrierEngine(runtime);
}

/** Barrier sources share a per-recipient cooldown; only recipients of the accepted barrier gain alacrity. */
function channelBarrierAlacrity(runtime: EngineerRuntime, event: EngineerResolverEvent): void {
  if (
    event.kind !== 'barrier' ||
    (event.actorType !== 'player' && event.ownerActorType !== 'player' && event.summonOwner !== 'engineer.mech')
  )
    return;
  const audience = event.resolvedAudience;
  if (!audience) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_FRAME_CHANNELING_CONDUITS);
  if (!profile.effects?.some((effect) => effect.type === 'boon' && effect.boon === 'alacrity')) return;
  const interval = balanceProfileNumber(profile, 'internalCooldown');
  const claim = (recipient: string): boolean => {
    const key = `${TRAIT.MECH_FRAME_CHANNELING_CONDUITS}:${recipient}`;
    // A one-second barrier pulse is eligible as soon as this recipient's one-second ICD expires.
    if (canonicalTime(event.at) < canonicalTime(runtime.procs.deadline(key))) return false;
    runtime.procs.setDeadline(key, event.at + interval);
    return true;
  };

  const recipients = [
    ...(audience.includesSelf ? [{ key: 'self', audience: { recipients: 'self' as const } }] : []),
    ...Array.from({ length: audience.alliedPlayerCount }, (_, index) => {
      const ally = audience.alliedPlayerIndex ?? index + 1;
      return {
        key: `ally:${ally}`,
        audience: {
          recipients: 'party' as const,
          affectsSelf: false,
          alliedPlayerIndex: ally,
          maximumRecipients: 1,
          eligibleCompanionIds: []
        }
      };
    }),
    ...audience.companionIds.map((id) => ({
      key: `companion:${id}`,
      audience: { recipients: 'summons' as const, affectsSelf: false, maximumRecipients: 1, eligibleCompanionIds: [id] }
    }))
  ];
  for (const recipient of recipients) {
    if (!claim(recipient.key)) continue;
    emitTraitProfile(runtime, profile.id, profile.id, event, {
      attribution: {
        source: 'Trait',
        sourceId: profile.id,
        skillName: profile.name,
        skillId: undefined,
        actorType: 'player'
      },
      transform: (packet) => ({ ...packet, audience: recipient.audience }),
      preserveName: true
    });
  }
}
