import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

/** Owns imperative Discipline trait effects while the public dispatcher preserves cross-line ordering. */

import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { gainWarriorAdrenaline } from '#gw2/professions/warrior/family-state.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { warriorBoonActive, warriorEventSkill } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

// Only sampled axe criticals grant the bonus adrenaline.
export function applyAxeMastery(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.AXE_MASTERY) || event.offTarget) return;
  const skill = context.catalog.skillsById.get(event.skillId ?? '');
  if ((skill?.skillWeapon || skill?.weapon || event.skillWeapon) !== 'Axe') return;
  const application = advanceScheduledCriticalProc(
    context,
    event,
    { id: 'warrior.core.axe-mastery' },
    undefined,
    Math.max(1, Number(event.hits || 1))
  );
  if (application)
    gainWarriorAdrenaline(
      context,
      application.quantity *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.axeMastery), 'resourceGain')
    );
}

// Refund the configured burst resource and resolve Swiftness after same-time burst packets.
export function applyBurstMastery(
  context: WarriorCastContext,
  skill: WarriorSkill,
  adrenalineSpent: number,
  options: {
    readonly resourceSpent?: number;
    readonly resourceRefundRate?: number;
  } = {}
): void {
  if (!skill.burst || adrenalineSpent <= 0 || !hasTrait(context, TRAIT.BURST_MASTERY)) return;

  const burstMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.burstMastery);
  const swiftness = requireEffect(burstMasteryProfile, 'boon', 'swiftness');
  const resourceSpent = Number(options.resourceSpent ?? adrenalineSpent);
  const resourceRefundRate = Number(
    options.resourceRefundRate ?? balanceProfileNumber(burstMasteryProfile, 'resourceGain')
  );
  gainWarriorAdrenaline(context, Math.max(0, resourceSpent) * resourceRefundRate);
  if (swiftness)
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      priority: 5,
      source: 'Trait',
      sourceId: TRAIT.BURST_MASTERY,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Burst Mastery — Swiftness',
      kind: 'swiftness',
      boon: 'swiftness',
      stacks: effectNumber(burstMasteryProfile, swiftness, 'stacks'),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        'swiftness',
        effectNumber(burstMasteryProfile, swiftness, 'duration')
      )
    });
}

// Grant Versatile Rage adrenaline between Martial Cadence reset and Furious Burst.
export function applyVersatileRage(context: WarriorCastContext): void {
  if (hasTrait(context, TRAIT.VERSATILE_RAGE))
    gainWarriorAdrenaline(
      context,
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VERSATILE_RAGE), 'resourceGain')
    );
}

export const warriorDisciplineModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.warriors-sprint',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_SPRINT) && warriorBoonActive(context, 'swiftness')
  },
  {
    id: 'warrior.burst-mastery',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BURST_MASTERY) && Boolean(warriorEventSkill(context)?.burst)
  }
]);
