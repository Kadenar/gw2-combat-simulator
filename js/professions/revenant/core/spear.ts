import { professionCoreState } from '../../../platform/engine/profession/state.js';
/**
 * Revenant spear recharge and Crushing Abyss mechanics.
 *
 * The first four spear skills reduce Abyssal Raze's active count recharge on
 * hit. Abyssal Raze scales from the Crushing Abyss stacks that existed before
 * that use, then grants one new ten-second stack after its impact.
 */
import { REVENANT_SKILL_IDS as ID } from '../data/ids.js';
import { emitRevenantState } from './shared.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantConfig,
  RevenantCoreState,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../types.js';

const RECHARGE_TASK = 'revenant.abyssal-raze-recharge';
const CRUSHING_GAIN_TASK = 'revenant.crushing-abyss-gain';
const CRUSHING_SWAP_TASK = 'revenant.crushing-abyss-weapon-swap';

function activeCrushingAbyss(state: RevenantCoreState, at: number): number[] {
  state.crushingAbyss = (state.crushingAbyss || []).filter((expiresAt) => Number(expiresAt) > at);
  return state.crushingAbyss;
}

function crushingAbyssStacksAt(state: RevenantCoreState, at: number): number {
  return (state.crushingAbyss || []).filter((expiresAt) => Number(expiresAt) > at).length;
}

function weaponSet(config: RevenantConfig, set: number): string[] {
  return set === 2
    ? [config.weaponSet2Primary || '', config.weaponSet2Secondary || '']
    : [config.primaryWeapon || '', config.secondaryWeapon || ''];
}

function sameWeaponSet(config: RevenantConfig, first: number, second: number): boolean {
  return JSON.stringify(weaponSet(config, first)) === JSON.stringify(weaponSet(config, second));
}

function emitAbyssalRazePackets(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  crushingAbyssStacks: number,
  triggeredBy = ''
): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition');
  const baseTorment = conditions?.find((effect) => !effect.metadata?.trigger);
  const crushingTorment = conditions?.find((effect) => effect.metadata?.trigger === 'crushing-abyss');
  if (!strike || !baseTorment || !crushingTorment) {
    throw new Error('Abyssal Raze is missing its declarative effects.');
  }

  const coefficient = triggeredBy
    ? Number(strike.coefficient || 0)
    : Number(strike.coefficient || 0) * (1 + Number(strike.damageIncreasePerStack || 0) * crushingAbyssStacks);
  const common = {
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    skillWeapon: 'Spear',
    ...(triggeredBy ? { triggeredBy } : {})
  };
  context.emit({
    ...common,
    type: 'damage',
    name: triggeredBy ? 'Abyssal Raze — Crushing Abyss' : 'Abyssal Raze',
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    crushingAbyssStacks
  });
  context.emit({
    ...common,
    type: 'condition',
    name: 'Abyssal Raze — Torment',
    condition: 'Torment',
    stacks: Number(baseTorment.stacks || 0),
    duration: Number(baseTorment.duration || 0)
  });
  if (crushingAbyssStacks > 0) {
    context.emit({
      ...common,
      type: 'condition',
      name: 'Abyssal Raze — Crushing Abyss Torment',
      condition: 'Torment',
      stacks: Number(crushingTorment.stacks || 0) * crushingAbyssStacks,
      duration: Number(crushingTorment.duration || 0),
      crushingAbyssStacks
    });
  }
}

/** Replaces Abyssal Raze's packets with its current stack-scaled profile. */
export function castAbyssalRaze(context: RevenantCastContext, skill: RevenantSkill): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) throw new Error('Abyssal Raze is missing its strike effect.');
  const at = context.start + Number(strike.atMs || 0) / 1000;
  const stacks = crushingAbyssStacksAt(professionCoreState(context), at);
  emitAbyssalRazePackets(context, skill, at, stacks);
  context.tasks.schedule({
    id: `${CRUSHING_GAIN_TASK}:${context.reservationId}`,
    type: CRUSHING_GAIN_TASK,
    at,
    payload: {}
  });
}

/**
 * Schedules one recharge reduction from the first strike packet of a spear
 * skill. Scheduling at impact preserves recharge behavior for interrupted
 * casts and delayed pulses.
 */
export function scheduleAbyssalRazeRechargeReduction(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  event: RevenantSimulationEvent
): void {
  const seconds = Number(skill.rechargeReduction || 0);
  if (!seconds || event.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  context.tasks.schedule({
    id: `${RECHARGE_TASK}:${event.__order ?? event.at}`,
    type: RECHARGE_TASK,
    at: event.at,
    payload: {
      seconds,
      sourceSkillId: skill.id,
      sourceSkillName: skill.name
    }
  });
}

/** Applies a hit-confirmed reduction to the active count recharge only. */
export function handleAbyssalRazeRechargeReduction(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{
    seconds: number;
    sourceSkillId: SkillId;
    sourceSkillName: string;
  }>
): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  const sourceSkill = context.catalog.skillsById.get(task.payload.sourceSkillId);
  if (!skill) return;
  const { ammo, reducedBy } = context.cooldownController.reduceAmmoRecharge(skill, task.payload.seconds, task.at);
  if (!ammo || reducedBy <= 0) return;
  const cooldownReduction = Number(reducedBy.toFixed(3));
  context.emit({
    type: 'proc',
    procType: 'skill',
    at: task.at,
    source: 'revenant',
    sourceId: task.payload.sourceSkillId,
    actorType: 'player',
    skillId: task.payload.sourceSkillId,
    skillName: task.payload.sourceSkillName,
    sourceSkill: sourceSkill?.name || task.payload.sourceSkillName,
    icon: sourceSkill?.icon || '',
    name: `${task.payload.sourceSkillName} — Abyssal Raze recharge`,
    detail: `${cooldownReduction}s`,
    cooldownReduction
  });
}

/** Grants one ten-second Crushing Abyss stack, up to the maximum of three. */
export function handleCrushingAbyssGain(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  const effect = skill.effects?.find((candidate) => candidate.type === 'buff' && candidate.kind === 'crushing-abyss');
  if (!effect) throw new Error('Abyssal Raze is missing Crushing Abyss.');
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const duration = Math.max(0, Number(effect.duration || 0));
  const stacks = activeCrushingAbyss(professionCoreState(context), task.at);
  if (stacks.length >= maximum) return;
  stacks.push(task.at + duration);
  const effectId = effect.sourceId ?? ID.ABYSSAL_RAZE;
  const effectName = String(effect.name || 'Crushing Abyss');
  context.emit({
    type: 'buff',
    at: task.at,
    source: 'revenant',
    sourceId: ID.ABYSSAL_RAZE,
    actorType: 'player',
    skillId: effectId,
    skillName: effectName,
    icon: skill.icon,
    name: effectName,
    kind: 'crushing-abyss',
    duration,
    stacks: 1
  });
  context.emit({
    type: 'proc',
    procType: 'skill',
    at: task.at,
    source: 'revenant',
    sourceId: ID.ABYSSAL_RAZE,
    actorType: 'player',
    skillId: effectId,
    skillName: effectName,
    sourceSkill: skill.name,
    icon: skill.icon,
    name: effectName,
    detail: `${stacks.length}/${maximum} stacks`
  });
  emitRevenantState(context, task.at, 'crushing-abyss-gain');
}

/** Queues the max-stack weapon-swap attack at the swap's completion time. */
export function observeRevenantSpearEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type !== 'weapon_set' || event.skillId !== ID.SWAP_WEAPONS) return;
  context.tasks.schedule({
    id: `${CRUSHING_SWAP_TASK}:${event.__order ?? event.at}`,
    type: CRUSHING_SWAP_TASK,
    at: event.at,
    payload: { weaponSet: event.weaponSet }
  });
}

/** Unleashes one max-stack Raze when swapping to a different weapon set. */
export function handleCrushingAbyssWeaponSwap(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ weaponSet?: number }>
): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const stacks = activeCrushingAbyss(professionCoreState(context), task.at);
  if (stacks.length < maximum) return;
  const destination = Number(task.payload.weaponSet) === 2 ? 2 : 1;
  const origin = destination === 2 ? 1 : 2;
  if (sameWeaponSet(context.config, origin, destination)) return;
  professionCoreState(context).crushingAbyss = [];
  emitAbyssalRazePackets(context, skill, task.at, maximum, 'Swap Weapons');
  emitRevenantState(context, task.at, 'crushing-abyss-weapon-swap');
}

/** Removes expired Crushing Abyss stacks from projected scheduler state. */
export function advanceRevenantSpearState(context: RevenantSchedulerContext, time: number): void {
  activeCrushingAbyss(professionCoreState(context), time);
}

export const revenantSpearSkillHandlers = Object.freeze({
  'revenant.spear-recharge': scheduleAbyssalRazeRechargeReduction,
  'revenant.abyssal-raze': castAbyssalRaze
});
