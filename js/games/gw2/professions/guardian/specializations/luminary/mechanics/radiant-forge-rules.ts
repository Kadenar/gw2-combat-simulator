import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import {
  guardianTargetDisabled,
  guardianTimedBuffActive,
  latestGuardianTimedBuff
} from '#gw2/professions/guardian/core/traits/modifiers.js';
import {
  advanceRadiantForgeState,
  radiantForgeAvailability
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  observeLuminaryScheduledEvent,
  updateLuminaryTraitCastState
} from '#gw2/professions/guardian/specializations/luminary/traits/index.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import type {
  GuardianPrecastContext,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

const GLARING_BURST_VARIANT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  hammer: 'Hammer',
  staff: 'Staff',
  blade: 'Sword',
  bulwark: 'Shield'
});

/** Labels each Glaring Burst action with the runtime-selected weapon variant for timeline tooltips. */
function prepareGlaringBurstAction(
  context: GuardianSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  if (event.type !== 'action' || event.skillId !== GUARDIAN_SKILL_IDS.GLARING_BURST) return event;
  const state = luminaryState.from(context);
  const weapon = state.radiantWeapon;
  const label = GLARING_BURST_VARIANT_LABELS[weapon] || 'No radiant weapon';
  return {
    ...event,
    detail: `Variant: ${label}${weapon === 'blade' ? ` (${state.glaringBurstSwordSlow ? 'slow' : 'fast'})` : ''}`
  };
}

/** Uses the sword variant's observed fast/slow cadence while preserving Quickness scaling. */
function modifyGlaringBurstCastDuration(context: GuardianPrecastContext, duration: number): number {
  if (context.skill.id !== GUARDIAN_SKILL_IDS.GLARING_BURST || luminaryState.from(context).radiantWeapon !== 'blade')
    return duration;
  const quicknessMs = luminaryState.from(context).glaringBurstSwordSlow ? 680 : 440;
  return duration * (quicknessMs / Number(context.skill.quicknessCastTimeMs || 600));
}

/** Applies a stance modifier to its own impact or proc only when an older application was already active. */
function stanceModifierActive(context: Gw2ModifierContext, kind: string, skillId: number, skillName: string): boolean {
  if (!guardianTimedBuffActive(context, kind)) return false;
  if (context.event?.skillId !== skillId && context.event?.triggeredBy !== skillName) return true;
  return (context.events || []).some(
    (event) =>
      event.type === 'buff' &&
      event.kind === kind &&
      event.at < context.time &&
      event.at + Number(event.duration || 0) > context.time
  );
}

export const luminaryModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.empowered-armaments',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => guardianTimedBuffActive(context, 'guardian-empowered-armaments')
  },
  {
    id: 'guardian.radiant-armaments',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) => {
      const armament = latestGuardianTimedBuff(context, 'guardian-radiant-armaments');
      // The buff is emitted for every radiant weapon, but the +7% bonus is
      // exclusive to the hammer (Dazzling Hammer). The manual expiry check is
      // necessary because latestGuardianTimedBuff returns the most-recently
      // applied record regardless of whether it has expired.
      return (
        armament?.metadata?.radiantWeapon === 'hammer' && armament.at + Number(armament.duration || 0) > context.time
      );
    }
  },
  {
    id: 'guardian.piercing-stance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      stanceModifierActive(context, 'guardian-piercing-stance', GUARDIAN_SKILL_IDS.PIERCING_STANCE, 'Piercing Stance')
  },
  {
    id: 'guardian.daring-advance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    // order: 100 places this after additive stacking; multiplicative modifiers
    // that interact with additive sums must sort after them.
    order: 100,
    when: (context) =>
      stanceModifierActive(context, 'guardian-daring-advance', GUARDIAN_SKILL_IDS.DARING_ADVANCE, 'Daring Advance')
  },
  {
    id: 'guardian.shining-spin',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    when: (context) => context.event?.skillId === GUARDIAN_SKILL_IDS.SHINING_SPIN && guardianTargetDisabled(context)
  },
  {
    id: 'guardian.glaring-burst-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // Glaring Burst's hammer variant scales its packet after shared additive damage bonuses.
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST && context.event?.metadata?.radiantWeapon === 'hammer'
  },
  {
    id: 'guardian.gleaming-blade',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLEAMING_BLADE &&
      guardianTimedBuffActive(context, 'guardian-radiant-courage-sword')
  }
]);

export const luminaryAttributeRules = Object.freeze({
  modifierRules: luminaryModifierRules
});

export const luminaryCastRules = Object.freeze({
  modifyCastDuration: modifyGlaringBurstCastDuration,
  availability: Object.freeze([
    {
      id: 'guardian.radiant-forge',
      order: 120,
      handler: radiantForgeAvailability
    }
  ])
});

/** Runs Luminary mechanics owned by one completed skill activation. */
export const luminarySkillMechanicHandlers = Object.freeze({
  'guardian.luminary.clear-forge-entry-cooldown': ({
    context,
    skill
  }: {
    context: GuardianSchedulerContext;
    skill: GuardianSkill;
  }): void => {
    context.state.cooldowns.delete(skill.id);
  }
});

export const luminarySchedulerHooks = Object.freeze({
  prepareEvent: Object.freeze({
    id: 'guardian.glaring-burst-variant',
    order: 20,
    handler: prepareGlaringBurstAction
  }),
  advance: Object.freeze([
    {
      id: 'guardian.radiant-forge',
      order: 20,
      handler: advanceRadiantForgeState
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.luminary.traits',
      order: 30,
      handler: updateLuminaryTraitCastState
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.luminary.traits',
      order: 20,
      handler: observeLuminaryScheduledEvent
    }
  ])
});
