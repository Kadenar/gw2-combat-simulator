/** Owns Crushing Abyss stacks, recharge tasks, and weapon-swap state across spear casts. */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  RevenantConfig,
  RevenantCoreState,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

const RECHARGE_TASK = 'revenant.abyssal-raze-recharge';
export const CRUSHING_GAIN_TASK = 'revenant.crushing-abyss-gain';
const CRUSHING_SWAP_TASK = 'revenant.crushing-abyss-weapon-swap';

function activeCrushingAbyss(state: RevenantCoreState, at: number): number[] {
  state.crushingAbyss = (state.crushingAbyss || []).filter((expiresAt) => Number(expiresAt) > at);
  return state.crushingAbyss;
}

/** Reads the stack count at an impact without mutating future expirations. */
export function crushingAbyssStacksAt(state: RevenantCoreState, at: number): number {
  return (state.crushingAbyss || []).filter((expiresAt) => Number(expiresAt) > at).length;
}

function weaponSet(config: RevenantConfig, set: number): string[] {
  return gw2ConfiguredWeaponSet(config, set).map((weapon) => weapon || '');
}

function sameWeaponSet(config: RevenantConfig, first: number, second: number): boolean {
  return JSON.stringify(weaponSet(config, first)) === JSON.stringify(weaponSet(config, second));
}

/** Schedules a recharge reduction from the first qualifying spear strike packet. */
export function scheduleAbyssalRazeRechargeReduction(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  event: RevenantSimulationEvent
): void {
  const seconds = Number(skill.rechargeReduction || 0);
  if (!seconds || event.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  context.tasks.schedule({
    id: `${RECHARGE_TASK}:${event.eventOrder ?? event.at}`,
    type: RECHARGE_TASK,
    at: event.at,
    payload: {
      seconds,
      sourceSkillId: skill.id,
      sourceSkillName: skill.name
    }
  });
}

/** Applies a hit-confirmed reduction to the active Abyssal Raze count recharge. */
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

/** Grants one Crushing Abyss stack at the delayed impact, up to the skill maximum. */
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
  emitSkillBuff(context, {
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
  emitRevenantStateSnapshot(context, task.at, 'crushing-abyss-gain');
}

/** Queues a max-stack weapon-swap check at the swap's completion time. */
export function observeRevenantSpearEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type !== 'weapon_set' || event.skillId !== ID.SWAP_WEAPONS) return;
  context.tasks.schedule({
    id: `${CRUSHING_SWAP_TASK}:${event.eventOrder ?? event.at}`,
    type: CRUSHING_SWAP_TASK,
    at: event.at,
    payload: { weaponSet: event.weaponSet }
  });
}

/** Consumes max stacks only when swapping to a genuinely different weapon set. */
export function consumeCrushingAbyssWeaponSwap(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ weaponSet?: number }>
): { skill: RevenantSkill; stacks: number } | null {
  if (!task.payload) return null;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE) as RevenantSkill | undefined;
  if (!skill) return null;
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const stacks = activeCrushingAbyss(professionCoreState(context), task.at);
  if (stacks.length < maximum) return null;
  const destination = Number(task.payload.weaponSet) === 2 ? 2 : 1;
  if (sameWeaponSet(context.config, destination === 2 ? 1 : 2, destination)) return null;
  professionCoreState(context).crushingAbyss = [];
  return { skill, stacks: maximum };
}

/** Publishes the cleared Crushing Abyss state after the swap-owned packet is emitted. */
export function completeCrushingAbyssWeaponSwap(context: RevenantSchedulerContext, at: number): void {
  emitRevenantStateSnapshot(context, at, 'crushing-abyss-weapon-swap');
}

/** Prunes expired Crushing Abyss stacks as scheduler time advances. */
export function advanceRevenantSpearState(context: RevenantSchedulerContext, time: number): void {
  activeCrushingAbyss(professionCoreState(context), time);
}
