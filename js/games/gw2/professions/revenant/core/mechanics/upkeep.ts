import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { effectiveRevenantEnergyCost } from '#gw2/professions/revenant/energy.js';
import { requireRevenantEffect as effectByType } from '#gw2/professions/revenant/core/traits/profile-access.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/timelines.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
/**
 * Revenant Core upkeep and pulse state machines.
 *
 * Toggles and releases shared upkeep skills and handles recurring Core upkeep
 * pulses. Elite specializations own any additional upkeep lifecycle.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
  RevenantUpkeepState
} from '#gw2/professions/revenant/types.js';

const VENGEFUL_HAMMERS_IDS = new Set<SkillId>([ID.VENGEFUL_HAMMERS, ID.VENGEFUL_HAMMERS_ID_56752]);

interface UpkeepTaskPayload extends SchedulerRecord {
  readonly skillId: SkillId;
}

function pulseIntervalForUpkeep(skill: RevenantSkill | undefined): number {
  return Math.max(0, Number(skill?.pulseInterval ?? 1));
}

// Emit one Embrace the Darkness pulse with the current target-count and trait
// profile while retaining upkeep ownership.
function emitEmbraceTheDarknessPulse(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  active: RevenantUpkeepState,
  at: number
): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const torment = skill.effects?.find(
    (effect) =>
      effect.type === 'condition' &&
      String(effect.metadata?.trigger || '') === (active.empoweredNextPulse ? 'empowered-upkeep-pulse' : '')
  );
  if (strike?.type !== 'strike' || torment?.type !== 'condition') {
    throw new Error('Embrace the Darkness is missing its pulse effects.');
  }

  const tormentTick = conditionEffectTicks(torment)[0];

  emitSkillDamage(context, skill, {
    at,
    coefficient: strikeEffectCoefficient(strike),
    skillWeapon: 'Unequipped',
    canCrit: null
  });
  emitSkillCondition(context, skill, {
    at,
    condition: 'Torment',
    stacks: Number(tormentTick?.stacks || 0),
    duration: Number(tormentTick?.duration || 0)
  });
  active.empoweredNextPulse = false;
}

/** Toggles an upkeep instance and schedules/cancels its recurring pulse task. */
export function toggleRevenantUpkeep(context: RevenantCastContext, skill: RevenantSkill): void {
  // Sustained drain and pulse ownership require a committed activation.
  if (context.action.cancelled) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const index = state.activeUpkeeps.findIndex((upkeep) => upkeep.skillId === skill.id);
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitRevenantStateSnapshot(context, at, 'upkeep-disabled');
    return;
  }

  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
    // The cast may emit packets earlier, but its sustained Energy drain begins only when activation completes.
    startsAt: at,
    empoweredNextPulse: false
  };
  state.activeUpkeeps.push(active);
  const release = skill.flipSkillId == null ? null : context.catalog.skillsById.get(skill.flipSkillId);
  if (release) state.availableFlips[release.id] = true;
  if (skill.id === ID.EMBRACE_THE_DARKNESS) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    if (!strike) {
      throw new Error('Embrace the Darkness is missing its strike effect.');
    }

    emitEmbraceTheDarknessPulse(context, skill, active, context.start + Number(effectFirstAtMs(strike) || 0) / 1000);
  }

  // Core schedules only its packet producers; specialization cadences own their own queue deadlines.
  if (skill.id === ID.EMBRACE_THE_DARKNESS || VENGEFUL_HAMMERS_IDS.has(skill.id)) {
    context.tasks.schedule({
      type: 'revenant.upkeep-pulse',
      at:
        skill.id === ID.EMBRACE_THE_DARKNESS
          ? Math.floor(at + context.epsilon) + 1
          : at + pulseIntervalForUpkeep(skill),
      ownerId: `revenant.upkeep:${skill.id}`,
      payload: { skillId: skill.id }
    });
  }

  emitRevenantStateSnapshot(context, at, 'upkeep-enabled');
}

/** Releases an upkeep parent and applies its manual-release cooldown. */
export function releaseRevenantUpkeep(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const parent = skill.flipParentId == null ? null : context.catalog.skillsById.get(skill.flipParentId);
  if (!parent) return;
  state.activeUpkeeps = state.activeUpkeeps.filter((upkeep) => upkeep.skillId !== parent.id);
  delete state.availableFlips[skill.id];
  context.tasks.cancelOwner(`revenant.upkeep:${parent.id}`);
  const cooldown = Math.max(0, Number(parent.manualReleaseCooldown || 0));
  if (cooldown > 0) {
    context.state.cooldowns.set(parent.id, at + cooldown);
  }

  emitRevenantStateSnapshot(context, at, 'upkeep-released');
}

/** Resolves one recurring upkeep pulse and schedules the next occurrence. */
export function handleRevenantUpkeepPulse(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<UpkeepTaskPayload>
): void {
  if (!task.payload) return;
  const payload = task.payload;
  const active = professionCoreState(context).activeUpkeeps.find((upkeep) => upkeep.skillId === payload.skillId);
  if (!active) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  if (skill?.id === ID.EMBRACE_THE_DARKNESS) {
    emitEmbraceTheDarknessPulse(context, skill, active, task.at);
  } else if (skill && VENGEFUL_HAMMERS_IDS.has(skill.id)) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike');
    if (!strike) throw new Error('Vengeful Hammers is missing its strike effect.');

    const hammers = Math.max(1, Math.trunc(Number(strike.hits ?? 1)));
    if (!(Number(strike.atMs) >= 0)) {
      throw new Error('Vengeful Hammers requires one explicit simultaneous-hit timestamp.');
    }

    for (let index = 0; index < hammers; index += 1) {
      const hammer = index + 1;
      emitSkillDamage(context, skill, {
        at: task.at + Number(strike.atMs) / 1000,
        coefficient: Number(strike.coefficient || 0) / hammers,
        name: `Vengeful Hammers — Hammer ${hammer}`,
        hitIndex: hammer,
        totalHits: hammers,
        skillWeapon: 'Unequipped',
        canCrit: null
      });
    }
  } else {
    return;
  }

  context.tasks.schedule({
    type: 'revenant.upkeep-pulse',
    at: task.at + pulseIntervalForUpkeep(skill),
    ownerId: `revenant.upkeep:${payload.skillId}`,
    payload
  });
}

interface ImpossibleOddsTaskPayload extends SchedulerRecord {
  readonly event: SimulationEvent;
}

const IMPOSSIBLE_ODDS_TASK = 'revenant.impossible-odds-strike';

function canTriggerImpossibleOdds(event: RevenantSimulationEvent): boolean {
  return (
    event.type === 'damage' &&
    Number(event.coefficient || 0) > 0 &&
    event.skillId !== ID.IMPOSSIBLE_ODDS &&
    // Form attacks inherit player modifiers but must not recursively trigger on-hit attacks.
    event.skillId !== ID.LESSER_ENCHANTED_DAGGERS &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK_ELITE &&
    // Only Assassin's final shockwave triggers a follow-up.
    (event.skillId !== ID.RELEASE_POTENTIAL_ASSASSIN || event.hitIndex === event.totalHits) &&
    // Player-owned strikes include equipment effects; display source labels do not gate the proc.
    (event.actorType === 'player' || (event.actorType === 'effect' && isGw2PlayerModifierOwnedEvent(event)))
  );
}

/** Schedules eligible strike follow-ups; the task rechecks active upkeep and its cooldown at execution. */
export function scheduleImpossibleOddsStrike(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (canTriggerImpossibleOdds(event)) {
    context.tasks.schedule({
      id: `${IMPOSSIBLE_ODDS_TASK}:${event.eventOrder}`,
      type: IMPOSSIBLE_ODDS_TASK,
      at: event.at,
      payload: { event }
    });
  }
}

/** Emits a delayed Impossible Odds strike when its upkeep and ICD are active. */
export function handleImpossibleOddsStrike(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<ImpossibleOddsTaskPayload>
): void {
  if (!task.payload) return;
  const cause = task.payload.event;
  const state = professionCoreState(context);
  const impossible = context.catalog.skillsById.get(ID.IMPOSSIBLE_ODDS);
  if (
    !impossible ||
    !(state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === impossible.id) ||
    task.at + context.epsilon < Number(state.traitProcReadyAt.impossibleOdds || 0)
  ) {
    return;
  }

  const strike = effectByType(impossible, 'strike');
  if (strike?.type !== 'strike') return;
  state.traitProcReadyAt.impossibleOdds = task.at + Number(impossible.triggerIntervalMs || 0) / 1000;
  emitSkillDamage(context, {
    cause,
    at: task.at + Number(effectFirstAtMs(strike) || 0) / 1000,
    name: 'Impossible Odds',
    skillName: 'Impossible Odds',
    coefficient: strikeEffectCoefficient(strike),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'revenant',
    sourceId: impossible.id,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: impossible.id,
    skillWeapon: 'Unequipped',
    canTriggerCriticalSigils: true
  });
}

/** Arms the next Embrace pulse only after another Energy-costing skill is handled. */
export function empowerEmbraceTheDarkness(context: RevenantCastContext, skill: RevenantSkill): void {
  if (
    !([ID.EMBRACE_THE_DARKNESS, ID.RESIST_THE_DARKNESS] as readonly number[]).includes(Number(skill.id)) &&
    // Only Energy-costing skills empower Embrace; free attacks such as Shattershot do not.
    effectiveRevenantEnergyCost(context, skill) > 0
  ) {
    const embrace = professionCoreState(context).activeUpkeeps.find(
      (upkeep) => upkeep.skillId === ID.EMBRACE_THE_DARKNESS
    );
    if (embrace) embrace.empoweredNextPulse = true;
  }
}
