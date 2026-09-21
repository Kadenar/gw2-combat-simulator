import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
/** Owns Crushing Abyss stacks, recharge tasks, and weapon-swap state across spear casts. */
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { activeStackCount, addTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  RevenantConfig,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';

const RECHARGE_TASK = 'revenant.abyssal-raze-recharge';
export const CRUSHING_GAIN_TASK = 'revenant.crushing-abyss-gain';

function activeCrushingAbyss(state: RevenantCoreState, at: number): number[] {
  state.crushingAbyss = purgeExpiredStacks(state.crushingAbyss || [], at);
  return state.crushingAbyss;
}

/** Reads the stack count at an impact without mutating future expirations. */
export function crushingAbyssStacksAt(state: RevenantCoreState, at: number): number {
  return activeStackCount(state.crushingAbyss || [], at);
}

function weaponSet(config: RevenantConfig, set: number): string[] {
  return gw2ConfiguredWeaponSet(config, set).map((weapon) => weapon || '');
}

function sameWeaponSet(config: RevenantConfig, first: number, second: number): boolean {
  return JSON.stringify(weaponSet(config, first)) === JSON.stringify(weaponSet(config, second));
}

/** Capture authored recharge seconds at the committed hit, then reduce the live recharge at impact. */
export const abyssalRazeRechargeReaction = scheduledReaction<
  RevenantSchedulerContext,
  {
    readonly skill: RevenantSkill;
    readonly event: RevenantSimulationEvent;
  },
  { readonly seconds: number; readonly sourceSkillId: SkillId; readonly sourceSkillName: string }
>({
  id: RECHARGE_TASK,
  select(_context, { skill, event }) {
    const seconds = Number(skill.rechargeReduction || 0);
    if (!seconds || event.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return null;
    return {
      id: `${RECHARGE_TASK}:${event.eventOrder ?? event.at}`,
      at: event.at,
      payload: {
        seconds,
        sourceSkillId: skill.id,
        sourceSkillName: skill.name
      }
    };
  },
  execute(context, at, payload) {
    const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
    const sourceSkill = context.catalog.skillsById.get(payload.sourceSkillId);
    if (!skill || !(Number(skill.ammoRecharge) > 0)) return;
    // Spear reductions are authored in base seconds; the shared controller converts them to tracked recharge time.
    const reducedBy = context.cooldownController.reduceSkillRecharge(skill, payload.seconds, at);
    if (reducedBy <= 0) return;
    const cooldownReduction = Number(reducedBy.toFixed(3));
    context.emit({
      type: 'proc',
      procType: 'skill',
      at: at,
      source: 'revenant',
      sourceId: payload.sourceSkillId,
      actorType: 'player',
      skillId: payload.sourceSkillId,
      skillName: payload.sourceSkillName,
      sourceSkill: sourceSkill?.name || payload.sourceSkillName,
      icon: sourceSkill?.icon || '',
      name: `${payload.sourceSkillName} — Abyssal Raze recharge`,
      detail: `${cooldownReduction}s`,
      cooldownReduction
    });
  }
});

/** Grants one Crushing Abyss stack at the delayed impact, up to the skill maximum. */
export function handleCrushingAbyssGain(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  const effect = skill.effects?.find((candidate) => candidate.type === 'buff' && candidate.kind === 'crushing-abyss');
  if (!effect) throw new Error('Abyssal Raze is missing Crushing Abyss.');
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const duration = Math.max(0, Number(effect.duration || 0));
  const state = professionCoreState(context);
  const grant = addTimedStacks(activeCrushingAbyss(state, task.at), 1, task.at, duration, maximum);
  // At the cap the grant lands nothing, and the buff must not be published either.
  if (grant.added === 0) return;
  state.crushingAbyss = grant.expiries;
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
    detail: `${state.crushingAbyss.length}/${maximum} stacks`
  });
  emitRevenantStateSnapshot(context, task.at, 'crushing-abyss-gain');
}

/** Consumes max stacks only when swapping to a genuinely different weapon set. */
export function consumeCrushingAbyssWeaponSwap(
  context: RevenantSchedulerContext,
  at: number,
  weaponSet: number | undefined
): { skill: RevenantSkill; stacks: number } | null {
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE) as RevenantSkill | undefined;
  if (!skill) return null;
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const stacks = activeCrushingAbyss(professionCoreState(context), at);
  if (stacks.length < maximum) return null;
  const destination = Number(weaponSet) === 2 ? 2 : 1;
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
