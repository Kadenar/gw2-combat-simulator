import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import {
  dodgeAccepted,
  isEngineerToolbeltSkill,
  toolbeltActivated,
  type DodgeAcceptance,
  type ToolbeltActivation
} from '#gw2/professions/engineer/core/mechanics/activations.js';
import { reduceEngineerRecharge } from '#gw2/professions/engineer/core/mechanics/recharge.js';
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import { activeBoonStacks, engineerRuntimeState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  type EngineerResolverContext,
  type EngineerResolverEvent,
  type EngineerRuntime,
  type EngineerSkill
} from '#gw2/professions/engineer/types.js';
/** Owns Streamlined Kits tuning and behavior at its established runtime and build boundaries. */
export const streamlinedKits = defineTrait({
  // Kit entry admits this reward independently of the intrinsic kit transition.
  triggers: [
    {
      on: 'castCommit',
      run: (runtime, cast) => applyStreamlinedKits(runtime, cast.skill, runtime.time)
    }
  ],
  id: TRAIT.STREAMLINED_KITS,
  name: 'Streamlined Kits',
  balance: {
    internalCooldown: 20,
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 20 },
      { name: 'Streamlined Kits', type: 'strike', coefficient: 1.75, hits: 1 }
    ]
  }
});

/** Owns Optimized Activation tuning and behavior at its established runtime and build boundaries. */
export const optimizedActivation = defineTrait({
  id: TRAIT.OPTIMIZED_ACTIVATION,
  name: 'Optimized Activation',
  balance: {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 4 }]
  },
  // Vigor follows every accepted toolbelt activation, including independent mech commands.
  triggers: [
    onTriggerPoint(toolbeltActivated, {
      emit: TRAIT.OPTIMIZED_ACTIVATION,
      attribution: { actorType: 'player', name: 'Optimized Activation — vigor' }
    })
  ]
});

/** Owns Static Discharge tuning and behavior at its established runtime and build boundaries. */
export const staticDischarge = defineTrait({
  // The skill owns damage; the toolbelt action is retained only as its causal trigger.
  triggers: [
    onTriggerPoint(toolbeltActivated, { invoke: ID.STATIC_DISCHARGE_TRAIT_SKILL }),
    // Scheduled discharges resolve in the Core strike package after critical procs and before explosion rewards.
    {
      on: 'damage.resolved',
      when: (_runtime, event) => Number(event.coefficient) > 0 && event.skillId === ID.STATIC_DISCHARGE_TRAIT_SKILL,
      run: recordStaticDischargeProc
    }
  ],
  id: TRAIT.STATIC_DISCHARGE,
  name: 'Static Discharge',
  balance: {
    criticalDamage: 2
  },
  modifierRules: [
    {
      order: -9,
      requiresSelection: false,
      // Static Discharge doubles its completed critical multiplier without affecting other strikes.
      id: 'engineer.static-discharge-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.STATIC_DISCHARGE), 'criticalDamage'),
      when: (context) => context.event?.skillId === ID.STATIC_DISCHARGE_TRAIT_SKILL
    }
  ]
});

/** Owns Kinetic Battery tuning and behavior at its established runtime and build boundaries. */
export const kineticBattery = defineTrait({
  id: TRAIT.KINETIC_BATTERY,
  name: 'Kinetic Battery',
  balance: {
    maximumStacks: 5,
    effects: [
      { name: 'kinetic-battery', type: 'buff', kind: 'kinetic-battery', stacks: 1, duration: 5 },
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      // Superspeed accompanies the fifth charge without boon-duration scaling.
      { name: 'superspeed', type: 'buff', kind: 'superspeed', stacks: 1, duration: 5 }
    ]
  },
  modifierRules: [
    {
      order: -14,
      id: 'engineer.kinetic-battery',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBuffStacks(context, 'kinetic-battery', 1) > 0
    }
  ],
  triggers: [onTriggerPoint(toolbeltActivated, { run: chargeKineticBattery })],
  lifetime: { eventHandlers: { 'engineer.kinetic-battery': OBSERVABLE_EVENT_HANDLER } }
});

/** Owns Adrenal Implant tuning and behavior at its established runtime and build boundaries. */
export const adrenalImplant = defineTrait({
  triggers: [onTriggerPoint(dodgeAccepted, { run: reduceToolbeltRecharge })],
  id: TRAIT.ADRENAL_IMPLANT,
  name: 'Adrenal Implant',
  balance: { rechargeReduction: 1 }
});

/** Owns Power Wrench tuning and behavior at its established runtime and build boundaries. */
export const powerWrench = defineTrait({
  triggers: [onTriggerPoint(dodgeAccepted, { run: reduceEliteRecharge })],
  id: TRAIT.POWER_WRENCH,
  name: 'Power Wrench',
  balance: { rechargeReduction: 3 }
});

/** Owns Gadgeteer tuning and behavior at its established runtime and build boundaries. */
export const gadgeteer = defineTrait({
  id: TRAIT.GADGETEER,
  name: 'Gadgeteer',
  balance: { rechargeMultiplier: 0.8 },
  rechargeRules: [
    {
      when: (runtime, skill) =>
        !(isEngineerToolbeltSkill(skill) && hasTrait(runtime, TRAIT.MECHANIZED_DEPLOYMENT)) &&
        Boolean(skill.categories?.some((category) => category.toLowerCase() === 'gadget')),
      multiplier: { profile: TRAIT.GADGETEER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Mechanized Deployment tuning and behavior at its established runtime and build boundaries. */
export const mechanizedDeployment = defineTrait({
  id: TRAIT.MECHANIZED_DEPLOYMENT,
  name: 'Mechanized Deployment',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      when: (_runtime, skill) => isEngineerToolbeltSkill(skill),
      multiplier: { profile: TRAIT.MECHANIZED_DEPLOYMENT, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Excessive Energy tuning and behavior at its established runtime and build boundaries. */
export const excessiveEnergy = defineTrait({
  id: TRAIT.EXCESSIVE_ENERGY,
  name: 'Excessive Energy',
  modifierRules: [
    {
      order: -16,
      id: 'engineer.excessive-energy',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, 'vigor', 1) > 0
    }
  ]
});

/** Owns Takedown Round tuning and behavior at its established runtime and build boundaries. */
export const takedownRound = defineTrait({
  id: TRAIT.TAKEDOWN_ROUND,
  name: 'Takedown Round',
  modifierRules: [
    {
      order: -15,
      // Use the same endurance rule for live damage and isolated attribute previews.
      id: 'engineer.takedown-round',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => {
        const state = engineerRuntimeState(context);
        return (
          isGw2PlayerModifierOwnedEvent(context.event) &&
          !resourceAtLeast(
            state.endurance?.value ?? 0,
            balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks')
          )
        );
      }
    }
  ]
});

/** Applies Streamlined Kits on kit entry and adds Grenade Kit's mine strike when appropriate. */
function applyStreamlinedKits(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (skill.kitTransition !== 'equip' || !context.procs.claim(TRAIT.STREAMLINED_KITS, 'streamlinedKits', at)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.STREAMLINED_KITS);
  emitTraitProfile(context, profile.id, profile.id, undefined, {
    effects: (effect) => effect.type === 'boon' || (skill.id === ID.GRENADE_KIT && effect.type === 'strike'),
    at,
    attribution: (effect) => ({
      source: 'Trait',
      sourceId: TRAIT.STREAMLINED_KITS,
      actorType: effect.type === 'strike' ? 'effect' : 'player',
      ...(effect.type === 'strike' ? { ownerActorType: 'player' } : {}),
      skillId: skill.id,
      skillName: effect.type === 'strike' ? 'Drop Mine' : skill.name
    }),
    transform: (event) =>
      event.type === 'damage'
        ? {
            ...event,
            parentSkillName: skill.name,
            name: 'Drop Mine',
            skillWeapon: 'Unequipped',
            explosion: true,
            triggeredBy: skill.name
          }
        : { ...event, name: 'Streamlined Kits — ' + event.kind },
    preserveName: true
  });
}

/** Advances Kinetic Battery and reports charge progress after its fifth-cast buff package. */
function chargeKineticBattery(context: EngineerRuntime, { skill, at }: ToolbeltActivation): void {
  const state = professionCoreState(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.KINETIC_BATTERY);
  const maximumCharges = balanceProfileNumber(profile, 'maximumStacks');
  // Start the next battery cycle before emitting its reward so reactions see the reset charge count.
  const progress = advanceCounter(state.kineticCharges, 1, maximumCharges, 'reset');
  state.kineticCharges = progress.value;
  if (progress.reached) {
    emitTraitProfile(context, profile.id, profile.id, undefined, {
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.KINETIC_BATTERY,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      transform: (event) => ({
        ...event,
        name: event.kind === 'kinetic-battery' ? 'Kinetic Battery' : 'Kinetic Battery — ' + event.kind
      }),
      preserveName: true
    });
  }

  buildEngineerPackets('engineer.kinetic-battery', { at, kineticCharges: state.kineticCharges }).forEach((packet) =>
    context.effects.emit({ kind: 'packet', event: packet })
  );
}

/** Records Static Discharge when its scheduled trait strike resolves. */
function recordStaticDischargeProc(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Scheduled trait damage is not a rotation step, so expose it with its toolbelt trigger in Procs.
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.STATIC_DISCHARGE, actorType: 'effect' },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Static Discharge',
      at: event.at,
      sourceSkill: event.parentSkillName || event.triggeredBy || event.skillName,
      detail: '',
      icon: resolverSkill(context, ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || ''
    }
  });
}

/** Power Wrench reduces elite recharge at the accepted dodge boundary. */
function reduceEliteRecharge(runtime: EngineerRuntime, { cast }: DodgeAcceptance): void {
  reduceEngineerRecharge(
    runtime,
    cast,
    (skill) => skill.type === 'Elite' || skill.slot === 'Elite',
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.POWER_WRENCH), 'rechargeReduction'),
    TRAIT.POWER_WRENCH,
    'Power Wrench'
  );
}

/** Adrenal Implant reduces toolbelt recharge after Power Wrench has settled. */
function reduceToolbeltRecharge(runtime: EngineerRuntime, { cast }: DodgeAcceptance): void {
  reduceEngineerRecharge(
    runtime,
    cast,
    isEngineerToolbeltSkill,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ADRENAL_IMPLANT), 'rechargeReduction'),
    TRAIT.ADRENAL_IMPLANT,
    'Adrenal Implant'
  );
}
