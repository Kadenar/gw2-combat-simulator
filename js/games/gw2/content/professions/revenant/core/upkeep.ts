import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { emitSkillCondition, emitSkillDamage } from '../../../../platform/scheduler/skill-events.js';
import { snapshotRevenantState } from '../state.js';
/**
 * Revenant Core upkeep and pulse state machines.
 *
 * Toggles and releases shared upkeep skills and handles recurring Core upkeep
 * pulses. Elite specializations own any additional upkeep lifecycle.
 */
import { REVENANT_SKILL_IDS as ID } from '../data/ids.js';
import type { SchedulerRecord, SkillId } from '../../../../platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantUpkeepState
} from '../types.js';

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
  if (!strike || !torment) {
    throw new Error('Embrace the Darkness is missing its pulse effects.');
  }

  emitSkillDamage(context, skill, {
    at,
    coefficient: Number(strike.coefficient || 0),
    skillWeapon: 'Unequipped',
    canCrit: null
  });
  emitSkillCondition(context, skill, {
    at,
    condition: 'Torment',
    stacks: Number(torment.stacks || 0),
    duration: Number(torment.duration || 0)
  });
  active.empoweredNextPulse = false;
}

/** Toggles an upkeep instance and schedules/cancels its recurring pulse task. */
export function toggleRevenantUpkeep(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const index = state.activeUpkeeps.findIndex((upkeep) => upkeep.skillId === skill.id);
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitStateSnapshot(context, 'revenant', at, 'upkeep-disabled', snapshotRevenantState(context.state.profession));
    return;
  }

  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
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

    emitEmbraceTheDarknessPulse(context, skill, active, context.start + Number(strike.atMs || 0) / 1000);
  }

  context.tasks.schedule({
    type: 'revenant.upkeep-pulse',
    at:
      skill.id === ID.EMBRACE_THE_DARKNESS ? Math.floor(at + context.epsilon) + 1 : at + pulseIntervalForUpkeep(skill),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id }
  });
  emitStateSnapshot(context, 'revenant', at, 'upkeep-enabled', snapshotRevenantState(context.state.profession));
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

  emitStateSnapshot(context, 'revenant', at, 'upkeep-released', snapshotRevenantState(context.state.profession));
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
    const hammers = Math.max(0, Math.trunc(Number(strike.hits || 0)));
    const coefficient = Number(strike.coefficient || 0);
    for (let hammer = 1; hammer <= hammers; hammer += 1) {
      emitSkillDamage(context, skill, {
        at: task.at,
        coefficient,
        name: `Vengeful Hammers — Hammer ${hammer}`,
        hitIndex: hammer,
        totalHits: hammers,
        skillWeapon: 'Unequipped',
        canCrit: null
      });
    }
  }

  context.tasks.schedule({
    type: 'revenant.upkeep-pulse',
    at: task.at + pulseIntervalForUpkeep(skill),
    ownerId: `revenant.upkeep:${payload.skillId}`,
    payload
  });
}

/** Raw Core upkeep callbacks consumed by the Core handler registry. */
export const revenantUpkeepSkillHandlers = Object.freeze({
  'revenant.upkeep': toggleRevenantUpkeep,
  'revenant.upkeep-release': releaseRevenantUpkeep
});
