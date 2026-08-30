import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  recordTrait,
  resolverSkill
} from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import {
  ENGINEER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  engineerBalanceEffectValue,
  engineerBalanceValue
} from '#gw2/content/professions/engineer/core/profiles.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails
} from '#gw2/content/professions/engineer/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';

/** Recognizes resolver events produced by the mech, including legacy summon packets inferred by mechanic slot. */
function isEngineerMechEvent(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.engineerMech === true || event.application?.engineerMech === true) return true;
  if (event.actorType !== 'summon') return false;
  const skill = resolverSkill(context, event.skillId ?? event.application?.skillId);
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

// The mech owns an independent Incendiary Powder tracker so its critical hits
// cannot consume the player's progress or internal cooldown.
export const mechanistCriticalHitDefinitions = Object.freeze([
  {
    id: 'engineer.mechanist.incendiary-powder-mech',
    actorTypes: ['summon'],
    when: (context, event) =>
      Number(event.coefficient) > 0 &&
      isEngineerMechEvent(context, event) &&
      hasTrait(context, TRAIT.INCENDIARY_POWDER),
    expectedProgress: {
      get: (context) => Number(procState(context)['incendiaryProgress.mech'] || 0),
      set: (context, progress) => {
        procState(context)['incendiaryProgress.mech'] = progress;
      }
    },
    internalCooldown: {
      duration: (context) => engineerBalanceValue(context, CORE_PROFILE.incendiaryPowder, 'internalCooldown', 10),
      readyAt: (context) => Number(procState(context)['incendiaryPowder.mech'] || 0),
      setReadyAt: (context, readyAt) => {
        procState(context)['incendiaryPowder.mech'] = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.INCENDIARY_POWDER },
    handler(context, event) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Incendiary Powder',
        condition: 'Burning',
        stacks: engineerBalanceEffectValue(context, CORE_PROFILE.incendiaryPowder, 'condition', 'stacks', 1),
        duration: engineerBalanceEffectValue(context, CORE_PROFILE.incendiaryPowder, 'condition', 'duration', 8),
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: 'summon',
        metadata: { engineerMech: true }
      });
      recordTrait(context, 'Incendiary Powder', event);
    }
  }
] satisfies readonly ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails
>[]);

/** Applies on-damage arm traits to qualifying mech strikes while maintaining their independent cooldowns. */
function reactToMechanistDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  _details: EngineerResolverReactionDetails = {}
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (!isEngineerMechEvent(context, event)) return;

  if (
    hasTrait(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS) &&
    isInternalCooldownReady(event.at, Number(state.singleEdgeCutters || 0))
  ) {
    // 1-second ICD: store next-eligible timestamp so rapid mech hits don't
    // trigger the trait on every packet.
    state.singleEdgeCutters = event.at + 1;
    applyEngineerDerivedCondition(context, event, {
      name: 'Mech Arms: Single-Edge Cutters',
      condition: 'Bleeding',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      actorType: 'summon',
      metadata: { engineerMech: true }
    });
    recordTrait(context, 'Mech Arms: Single-Edge Cutters', event);
  }

  if (
    hasTrait(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS) &&
    isInternalCooldownReady(event.at, Number(state.highImpactDrivers || 0))
  ) {
    // Same 1-second ICD pattern as Single-Edge Cutters above.
    state.highImpactDrivers = event.at + 1;
    queueBuff(context, event, {
      name: 'Mech Arms: High-Impact Drivers',
      kind: 'might',
      stacks: 1,
      duration: 10,
      sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      actorType: 'effect'
    });
    recordTrait(context, 'Mech Arms: High-Impact Drivers', event);
  }

  if (event.mechBasicAttack === true && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    applyEngineerDerivedCondition(context, event, {
      name: 'Mech Arms: Jade Cannons',
      condition: 'Vulnerability',
      stacks: 1,
      duration: 6,
      sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
      actorType: 'summon',
      metadata: { engineerMech: true }
    });
  }
}

export const mechanistResolverEventReactions = Object.freeze({
  damage: reactToMechanistDamage
});
