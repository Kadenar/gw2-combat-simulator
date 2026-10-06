import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { activeBoonStacks, buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import {
  EngineerSkill,
  type EngineerResolverEvent,
  type EngineerRuntime,
  type EngineerResolverContext
} from '#gw2/professions/engineer/types.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { type Gw2Stats } from '#gw2/platform/combat/stats.js';
import { activeBoonStacks as modifierBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { type SimulationEvent } from '#gw2/platform/events/events.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { type RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

/** Keeps one pending Stability pulse and rechecks selection and live Stability before each grant. */
export function triggerMassMomentum(context: EngineerRuntime, event: EngineerResolverEvent): void | false {
  if (!hasTrait(context, TRAIT.MASS_MOMENTUM) || activeBoonStacks(context, 'stability', 1, event.at) === 0)
    return false;
  const state = context.procs;
  const massMomentumProfile = requireBalanceProfileFromContext(context, TRAIT.MASS_MOMENTUM);
  if ((state.deadline('massMomentum') || 0) <= event.at) {
    state.setDeadline('massMomentum', event.at + balanceProfileNumber(massMomentumProfile, 'pulseInterval'));
    const massMomentumMight = requireEffect(massMomentumProfile, 'boon', 'might');
    if (massMomentumMight) {
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerBuff(event, {
          name: 'Mass Momentum',
          kind: String(massMomentumMight.boon).toLowerCase(),
          stacks: Number(massMomentumMight.stacks),
          duration: massMomentumMight.duration,
          sourceId: TRAIT.MASS_MOMENTUM,
          actorType: 'effect'
        }),
        durationContext: event
      });

      context.effects.emit({
        attribution: { source: 'Trait', sourceId: TRAIT.MASS_MOMENTUM, actorType: 'effect' },
        kind: 'announcement',
        cause: event,
        announcement: { type: 'trait', name: 'Mass Momentum', at: event.at, sourceSkill: event.skillName, icon: '' }
      });
    }
  }

  const interval = balanceProfileNumber(massMomentumProfile, 'pulseInterval');
  const next = Math.max(event.at + interval, state.deadline('massMomentum') || 0);
  const live = scrapperState.from(context);
  if (interval > 0 && live.massMomentumAt > next) {
    live.massMomentumAt = next;
    context.schedule('engineer.mass-momentum', next, event);
  }
}

/** Positive damage packets can start the same Stability pulse loop. */
export function reactToScrapperDamage(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (Number(event.coefficient) > 0) triggerMassMomentum(context, event);
}

export function reactToAppliedForceBuff(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === 'might' &&
    hasTrait(context, TRAIT.APPLIED_FORCE) &&
    activeBoonStacks(
      context,
      'might',
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE), 'maximumStacks'),
      event.at
    ) >= balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE), 'threshold')
  ) {
    const state = context.procs;
    if (isInternalCooldownReady(event.at, state.deadline('appliedForce') || 0)) {
      const appliedForceProfile = requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE);
      state.setDeadline('appliedForce', event.at + balanceProfileNumber(appliedForceProfile, 'internalCooldown'));
      const appliedForceStability = requireEffect(appliedForceProfile, 'boon', 'stability');
      if (appliedForceStability) {
        context.effects.emit({
          kind: 'packet',
          event: buildEngineerBuff(event, {
            name: 'Applied Force',
            kind: String(appliedForceStability.boon).toLowerCase(),
            stacks: Number(appliedForceStability.stacks),
            duration: appliedForceStability.duration,
            sourceId: TRAIT.APPLIED_FORCE,
            actorType: 'effect'
          }),
          durationContext: event
        });

        context.effects.emit({
          attribution: { source: 'Trait', sourceId: TRAIT.APPLIED_FORCE, actorType: 'effect' },
          kind: 'announcement',
          cause: event,
          announcement: { type: 'trait', name: 'Applied Force', at: event.at, sourceSkill: event.skillName, icon: '' }
        });
      }
    }
  }
}

/** Adds Applied Force power at the existing live attribute boundary. */
export function applyAppliedForceAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  const appliedForceProfile = requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE);
  return {
    ...attributes,
    power:
      (attributes.power || 0) +
      modifierBoonStacks(context, 'might', balanceProfileNumber(appliedForceProfile, 'maximumStacks')) *
        balanceProfileNumber(appliedForceProfile, 'attributePerStack')
  };
}

/** Each accepted combo grants boons once, with a live Whirl-only internal cooldown. */
export function kineticAcceleratorBoons(context: EngineerResolverContext, event: SimulationEvent) {
  if (
    !hasTrait(context, TRAIT.KINETIC_ACCELERATORS) ||
    event.type !== 'combo' ||
    !['Blast', 'Leap', 'Whirl'].includes(String(event.finisherType))
  )
    return [];
  if (event.finisherType === 'Whirl') {
    // Only Whirl finishers claim an interval; Blast and Leap remain independent.
    if (!context.procs.claim(TRAIT.KINETIC_ACCELERATORS, 'engineer.scrapper.kineticAcceleratorsWhirl', event.at))
      return [];
  }

  return ['quickness', 'might'].flatMap((kind) => {
    const kineticAcceleratorsProfile = requireBalanceProfileFromContext(context, TRAIT.KINETIC_ACCELERATORS);
    const effect = requireEffect(kineticAcceleratorsProfile, 'boon', kind);
    if (!effect) return [];
    return [
      {
        type: 'buff' as const,
        at: event.at,
        priority: Number(event.priority || 0),
        activationId: event.activationId,
        comboId: event.comboId,
        source: 'Trait',
        sourceId: TRAIT.KINETIC_ACCELERATORS,
        actorType: 'effect' as const,
        skillId: event.skillId,
        skillName: event.skillName,
        name: `Kinetic Accelerators — ${kind}`,
        kind,
        duration: effect.duration,
        stacks: Number(effect.stacks),
        audience: { recipients: 'party' as const }
      }
    ];
  });
}

export function applyKineticAcceleratorsCast(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  const skill = cast.skill;
  if (skill.id !== ID.FUNCTION_GYRO) return;
  // Kinetic Accelerators (GM trait): Function Gyro becomes a blast finisher.
  // The marker gives the shared combo materializer a trait-gated descriptor
  // while preserving Function Gyro as the source of the resulting combo.
  if (hasTrait(context.traits, TRAIT.KINETIC_ACCELERATORS)) {
    produceRuntimeCombos(context, context.helpers, {
      type: 'action',
      endsAt: context.time,
      at: context.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Kinetic Accelerators — Function Gyro blast finisher',
      activationId: cast.id,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Blast',
          chance: 1,
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  }
}

export function reactToScrapperCombo(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const boons = kineticAcceleratorBoons(context, event);
  if (!boons.length) return;
  for (const boon of boons) context.effects.emit({ kind: 'packet', event: boon, durationContext: event });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.KINETIC_ACCELERATORS, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name: 'Kinetic Accelerators', at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}
