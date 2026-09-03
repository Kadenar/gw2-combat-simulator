import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { denySkillCast as deny } from '#gw2/content/professions/lib/availability.js';
import type { AvailabilityResult, SkillId } from '#gw2/platform/engine/types.js';
import type {
  ThiefCastContext,
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';

type TrapPreparedField = 'thousandNeedlesPrepared' | 'pitfallPrepared';
type TrapArmedAtField = 'thousandNeedlesArmedAt' | 'pitfallArmedAt';

interface TrapDefinition {
  readonly prepareId: SkillId;
  readonly triggerId: SkillId;
  readonly name: string;
  readonly reason: string;
  readonly preparedField: TrapPreparedField;
  readonly armedAtField: TrapArmedAtField;
}

const TRAPS: readonly TrapDefinition[] = Object.freeze([
  {
    prepareId: ID.PREPARE_THOUSAND_NEEDLES,
    triggerId: ID.THOUSAND_NEEDLES,
    name: 'Thousand Needles',
    reason: 'thousand-needles',
    preparedField: 'thousandNeedlesPrepared',
    armedAtField: 'thousandNeedlesArmedAt'
  },
  {
    prepareId: ID.PREPARE_PITFALL,
    triggerId: ID.PITFALL,
    name: 'Pitfall',
    reason: 'pitfall',
    preparedField: 'pitfallPrepared',
    armedAtField: 'pitfallArmedAt'
  }
]);

/** Arms a preparation after its placement cast while its parent cooldown continues independently. */
export function prepareTrap(context: ThiefCastContext, skill: ThiefSkill): void {
  const trap = TRAPS.find((candidate) => candidate.prepareId === skill.id);
  if (!trap) return;
  const state = professionCoreState(context) as ThiefCoreState;
  const at = context.effectiveEnd;
  state[trap.preparedField] = true;
  state[trap.armedAtField] = at + Number(skill.durationMultiplier || 3);
  emitThiefStateSnapshot(context, at, `prepare-${trap.reason}`);
}

/** Consumes an armed trap and mirrors the trigger's short rearm onto an already-recharged placement skill. */
export function activateTrap(context: ThiefCastContext, skill: ThiefSkill): void {
  const trap = TRAPS.find((candidate) => candidate.triggerId === skill.id);
  if (!trap) return;
  const state = professionCoreState(context) as ThiefCoreState;
  state[trap.preparedField] = false;
  state[trap.armedAtField] = 0;
  if (context.rechargeReadyAt != null) {
    context.state.cooldowns.set(
      trap.prepareId,
      Math.max(Number(context.state.cooldowns.get(trap.prepareId) || 0), context.rechargeReadyAt)
    );
  }

  emitThiefStateSnapshot(context, context.effectiveEnd, trap.reason);
}

/** Keeps each preparation flipped until triggered and blocks its trigger during the three-second arm window. */
export function thiefTrapCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult | null {
  const trap = TRAPS.find((candidate) => candidate.prepareId === skill.id || candidate.triggerId === skill.id);
  if (!trap) return null;
  const state = professionCoreState(context) as ThiefCoreState;
  if (skill.id === trap.prepareId && state[trap.preparedField]) {
    return deny(skill, `thief.${trap.reason}-prepared`, `activate ${trap.name} before preparing it again.`);
  }

  if (skill.id === trap.triggerId && !state[trap.preparedField]) {
    return deny(skill, `thief.${trap.reason}`, `prepare ${trap.name} first.`);
  }

  if (skill.id === trap.triggerId && state[trap.armedAtField] > context.start) {
    return deny(skill, `thief.${trap.reason}-arming`, 'the preparation is still arming.', state[trap.armedAtField]);
  }

  return null;
}
