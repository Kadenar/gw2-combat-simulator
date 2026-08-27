import { emitSkillBuff } from '../../../../platform/gw2/scheduler/skill-events.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { activeBoonStacks, playerStrike } from '../../core/rule-helpers.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '../../core/profiles.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import type { SchedulerRecord, SimulationEvent } from '../../../../platform/engine/types.js';
import type { EngineerMaximumAmmoContext, EngineerSchedulerContext, EngineerSkill } from '../../types.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { scrapperState } from './state.js';
import { applyScrapperCastTraits } from './traits.js';

function kineticAcceleratorsTriggerAllowed(context: EngineerSchedulerContext, event: SimulationEvent): boolean {
  if (
    !hasTrait(context.config, TRAIT.KINETIC_ACCELERATORS) ||
    event.type !== 'combo' ||
    event.schedulerPrediction !== 'combo-result' ||
    !['Blast', 'Leap', 'Whirl'].includes(String(event.finisherType))
  ) {
    return false;
  }

  if (event.finisherType !== 'Whirl') return true;
  const state = scrapperState.from(context);
  if (!isInternalCooldownReady(event.at, state.kineticAcceleratorsWhirlReadyAt)) {
    return false;
  }

  state.kineticAcceleratorsWhirlReadyAt =
    event.at + engineerBalanceValue(context, PROFILE.kineticAccelerators, 'internalCooldown', 3);
  return true;
}

function observeScrapperScheduledEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (!kineticAcceleratorsTriggerAllowed(context, event)) return;
  const sourceSkill =
    context.catalog?.skillsById.get(event.skillId ?? '') ||
    context.catalog?.skillsByName.get(String(event.skillName || '')) ||
    ({ id: TRAIT.KINETIC_ACCELERATORS, name: 'Kinetic Accelerators' } as EngineerSkill);
  // Both packets share the triggering combo attribution but remain explicit canonical emissions.
  for (const boon of [
    {
      kind: 'quickness',
      duration: engineerBalanceEffectValue(context, PROFILE.kineticAccelerators, 'boon', 'duration', 3),
      stacks: 1
    },
    {
      kind: 'might',
      duration: engineerBalanceEffectValue(context, PROFILE.kineticAccelerators, 'boon', 'duration', 10, 1),
      stacks: engineerBalanceEffectValue(context, PROFILE.kineticAccelerators, 'boon', 'stacks', 3, 1)
    }
  ]) {
    emitSkillBuff(context, {
      skill: sourceSkill,
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.KINETIC_ACCELERATORS,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: `Kinetic Accelerators — ${boon.kind}`,
      kind: boon.kind,
      duration: boon.duration,
      stacks: boon.stacks,
      recipients: 'party'
    });
  }
}

export const scrapperSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: 'engineer.kinetic-accelerators',
    order: 30,
    handler: observeScrapperScheduledEvent
  },
  // order 30 runs after core engineer hooks (10/20) but before any finisher hooks
  afterCast: {
    id: 'engineer.scrapper-traits',
    order: 30,
    handler: applyScrapperCastTraits
  }
});

export const scrapperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Object in Motion: +5% strike damage per active movement status (stability/swiftness/superspeed).
    // Multiplicative — three statuses = 1.05^3 ≈ +15.8%.
    id: 'engineer.object-in-motion',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damageFactorPerBoon: 1.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const count = ['stability', 'swiftness', 'superspeed'].filter(
        (kind) => activeBoonStacks(context, kind, 1) > 0
      ).length;
      return parameters.damageFactorPerBoon ** count;
    },
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.OBJECT_IN_MOTION)
  }
]);

// Applied Force (GM trait): each might stack (capped at 25) adds 30 flat power at cast time.
function modifyScrapperAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  return {
    ...attributes,
    power:
      Number(attributes.power || 0) +
      activeBoonStacks(context, 'might', engineerBalanceValue(context, PROFILE.appliedForce, 'maximumStacks', 25)) *
        engineerBalanceValue(context, PROFILE.appliedForce, 'attributePerStack', 30)
  };
}

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.
function modifyScrapperMaximumAmmo(context: EngineerMaximumAmmoContext, maximum: number): number {
  return context.skill?.name === 'Function Gyro' && hasTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(2, Number(maximum || 0))
    : maximum;
}

export const scrapperAttributeRules = Object.freeze({
  modifyAttributes: modifyScrapperAttributes,
  modifierRules: scrapperModifierRules
});

export const scrapperCastRules = Object.freeze({
  modifyMaximumAmmo: modifyScrapperMaximumAmmo
});
