/**
 * Owns Mine Field precast, detonation, and Gadgeteer packet behavior.
 * The Core execution registry owns handler registration; profession hooks own event observation.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { applyEngineerToolbeltTraits } from '#gw2/professions/engineer/core/traits/index.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { EngineerCastContext, EngineerSchedulerContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Emits every authored Mine Field damage and condition packet at a shared detonation time. */
function emitMineField(
  context: EngineerSchedulerContext,
  skill: EngineerSkill,
  at: number,
  activationId: string
): void {
  // Each surviving effect keeps its authored packets, moved together to the combat boundary.
  for (const effect of skill.effects || []) {
    for (const { event } of materializeSkillEffectApplications({
      skill,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: { source: 'engineer', sourceId: skill.id, actorType: 'player', activationId }
    })) {
      if (event.type === 'damage') {
        emitSkillDamage(context, skill, { ...event, at, coefficient: Number(event.coefficient) });
      }

      if (event.type === 'condition') {
        emitSkillCondition(context, {
          ...event,
          skill,
          at,
          condition: String(event.condition),
          stacks: Number(event.stacks),
          duration: Number(event.duration)
        });
      }
    }
  }
}

/** Defers a precast Mine Field until combat start or applies its immediate detonation traits. */
export function armPrecombatMineField(context: EngineerCastContext): void {
  if (context.hasExplicitCombatStart && context.combatStartTime == null) {
    professionCoreState(context).pendingMineFieldActivationIds.push(context.reservationId);
    return;
  }

  // An active Mine Field auto-detonates as its second toolbelt activation, so toolbelt traits fire again.
  const detonation = context.catalog.skillsById.get(ID.DETONATE_MINE_FIELD) as EngineerSkill | undefined;
  if (detonation) applyEngineerToolbeltTraits(context, detonation, context.effectiveEnd);
}

/** Adds Gadgeteer's bonus mine to a qualifying Detonate damage event. */
export function duplicateGadgeteerMine(
  context: EngineerCastContext,
  skill: EngineerSkill,
  event: SimulationEvent
): void {
  if (skill.id !== ID.DETONATE || event.type !== 'damage' || !hasTrait(context.config, TRAIT.GADGETEER)) return;
  // The added mine needs a separate combo attempt while sharing the original Detonate activation.
  const comboFinishers = Array.isArray(event.comboFinishers)
    ? (event.comboFinishers as readonly object[]).map((finisher) => ({
        ...finisher,
        attemptGroup: 'gadgeteer-mine'
      }))
    : undefined;
  emitSkillDamage(context, skill, {
    at: event.at,
    coefficient: Number(event.coefficient || 0),
    name: event.name,
    actorType: 'player',
    skillWeapon: String(event.skillWeapon || 'Unequipped'),
    damageKind: event.damageKind,
    comboFinishers
  });
}

/** Detonates Mine Fields held during precast when the explicit combat-start event arrives. */
export function observeEngineerMineFieldEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'combat_start') return;
  const state = professionCoreState(context);
  const pending = state.pendingMineFieldActivationIds.splice(0);
  const skill = context.catalog.skillsById.get(ID.MINE_FIELD) as EngineerSkill | undefined;
  const detonation = context.catalog.skillsById.get(ID.DETONATE_MINE_FIELD) as EngineerSkill | undefined;
  if (!skill || !detonation) return;
  for (const activationId of pending) {
    emitMineField(context, skill, event.at, activationId);
    // A precast field performs its second toolbelt activation only when combat lets the mines detonate.
    applyEngineerToolbeltTraits(context, detonation, event.at);
  }
}
