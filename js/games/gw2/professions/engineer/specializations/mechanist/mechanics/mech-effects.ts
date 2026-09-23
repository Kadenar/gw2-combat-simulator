import { isEngineerMechEvent as mechEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import {
  requireEffectFromContext,
  balanceProfileNumberFromContext,
  procChanceFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  recordTrait,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';

/** Recognizes resolver events produced by the mech, including legacy summon packets inferred by mechanic slot. */
function isEngineerMechEvent(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  return mechEvent(event, () => resolverSkill(context, event.skillId ?? event.application?.skillId));
}

// The mech owns independent Firearms proc trackers so its critical hits cannot consume the player's progress.
export const mechanistCriticalHitDefinitions = Object.freeze([
  {
    id: 'engineer.mechanist.serrated-steel-mech',
    actorTypes: ['summon'],
    when: (context, event) =>
      Number(event.coefficient) > 0 && isEngineerMechEvent(context, event) && hasTrait(context, TRAIT.SERRATED_STEEL),
    chanceOnCriticalHit: (context) => procChanceFromContext(context, CORE_PROFILE.serratedSteel),
    expectedProgress: {
      get: (context) => Number(procState(context)['serratedSteelProgress.mech'] || 0),
      set: (context, progress) => {
        procState(context)['serratedSteelProgress.mech'] = progress;
      }
    },
    randomStream: 'engineer.serrated-steel.mech',
    attribution: { kind: 'trait', id: TRAIT.SERRATED_STEEL },
    handler(context, event, _details, application) {
      const serratedSteelBleeding = requireEffectFromContext(
        context,
        'balance-profile',
        CORE_PROFILE.serratedSteel,
        'condition',
        'Bleeding'
      );
      if (serratedSteelBleeding) {
        applyEngineerDerivedCondition(context, event, {
          name: 'Serrated Steel',
          procCount: application.quantity,
          condition: String(serratedSteelBleeding.condition),
          stacks: Number(serratedSteelBleeding.stacks) * application.quantity,
          duration: Number(serratedSteelBleeding.duration),
          sourceId: TRAIT.SERRATED_STEEL,
          actorType: 'summon',
          metadata: { engineerMech: true }
        });

        recordTrait(context, 'Serrated Steel', event);
      }
    }
  },
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
      duration: (context) =>
        balanceProfileNumberFromContext(context, CORE_PROFILE.incendiaryPowder, 'internalCooldown'),
      readyAt: (context) => Number(procState(context)['incendiaryPowder.mech'] || 0),
      setReadyAt: (context, readyAt) => {
        procState(context)['incendiaryPowder.mech'] = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.INCENDIARY_POWDER },
    handler(context, event) {
      const incendiaryPowderBurning = requireEffectFromContext(
        context,
        'balance-profile',
        CORE_PROFILE.incendiaryPowder,
        'condition',
        'Burning'
      );
      if (incendiaryPowderBurning) {
        applyEngineerDerivedCondition(context, event, {
          name: 'Incendiary Powder',
          condition: String(incendiaryPowderBurning.condition),
          stacks: Number(incendiaryPowderBurning.stacks),
          duration: Number(incendiaryPowderBurning.duration),
          sourceId: TRAIT.INCENDIARY_POWDER,
          actorType: 'summon',
          metadata: { engineerMech: true }
        });

        recordTrait(context, 'Incendiary Powder', event);
      }
    }
  }
] satisfies readonly ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  NativeResolvedDamageDetails
>[]);

/** Applies on-damage arm traits to qualifying mech strikes while maintaining their independent cooldowns. */
function reactToMechanistDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  _details: NativeResolvedDamageDetails = {}
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (!isEngineerMechEvent(context, event)) return;

  if (
    hasTrait(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS) &&
    isInternalCooldownReady(event.at, Number(state.singleEdgeCutters || 0))
  ) {
    const packet = requireEffectFromContext(
      context,
      'balance-profile',
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      'condition',
      'Bleeding'
    );
    if (packet) {
      // A removed arm effect cannot consume its own proc cooldown.
      state.singleEdgeCutters =
        event.at + balanceProfileNumberFromContext(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, 'internalCooldown');
      applyEngineerDerivedCondition(context, event, {
        name: 'Mech Arms: Single-Edge Cutters',
        condition: String(packet.condition),
        stacks: Number(packet.stacks),
        duration: Number(packet.duration),
        sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        actorType: 'summon',
        metadata: { engineerMech: true }
      });

      recordTrait(context, 'Mech Arms: Single-Edge Cutters', event);
    }
  }

  if (
    hasTrait(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS) &&
    isInternalCooldownReady(event.at, Number(state.highImpactDrivers || 0))
  ) {
    const packet = requireEffectFromContext(
      context,
      'balance-profile',
      TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      'boon',
      'might'
    );
    if (packet) {
      state.highImpactDrivers =
        event.at + balanceProfileNumberFromContext(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, 'internalCooldown');
      queueBuff(context, event, {
        name: 'Mech Arms: High-Impact Drivers',
        kind: String(packet.boon).toLowerCase(),
        stacks: Number(packet.stacks),
        duration: Number(packet.duration),
        sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
        actorType: 'effect'
      });

      recordTrait(context, 'Mech Arms: High-Impact Drivers', event);
    }
  }

  if (event.mechBasicAttack === true && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    const vulnerability = requireEffectFromContext(
      context,
      'balance-profile',
      TRAIT.MECH_ARMS_JADE_CANNONS,
      'condition',
      'Vulnerability'
    );
    if (vulnerability)
      applyEngineerDerivedCondition(context, event, {
        name: 'Mech Arms: Jade Cannons',
        condition: String(vulnerability.condition),
        stacks: Number(vulnerability.stacks),
        duration: Number(vulnerability.duration),
        sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
        actorType: 'summon',
        metadata: { engineerMech: true }
      });
  }
}

export const mechanistResolverEventReactions = Object.freeze({
  damage: reactToMechanistDamage
});
