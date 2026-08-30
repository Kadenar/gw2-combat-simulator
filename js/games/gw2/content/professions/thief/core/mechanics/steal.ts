import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../../../platform/engine/events/state-snapshots.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { snapshotThiefState } from '../state.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { applyStealCompletionTraits } from '../traits/index.js';
import type { SkillId } from '../../../../../platform/engine/types.js';
import type { ThiefCastContext, ThiefCoreState, ThiefSkill } from '../../types.js';
import { thiefBalanceProfile, THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

export const THIEF_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.THROW_GUNK,
  ID.CONSUME_PLASMA,
  ID.WHIRLING_AXE
]);

export function storedStolenSkillChoices(
  state: Pick<ThiefCoreState, 'storedStolenSkillId' | 'storedStolenSkillIds' | 'storedStolenSkillCount'>
): readonly SkillId[] {
  if (Number(state.storedStolenSkillCount || 0) <= 0) return [];
  return state.storedStolenSkillId == null ? state.storedStolenSkillIds || [] : [state.storedStolenSkillId];
}

export function storeStolenSkillChoices(
  context: ThiefCastContext,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null,
  emitState = true
): void {
  const state = professionCoreState(context);
  const choices = [...new Set(skillIds.map(Number).filter(Number.isFinite))];
  // A steal grants a choice pool. Only forced mechanics preselect one; Improvisation locks its second use after selection.
  state.storedStolenSkillIds = choices;
  state.storedStolenSkillId = forcedSkillId;
  state.storedStolenSkillCount =
    choices.length === 0
      ? 0
      : hasTrait(context.config, TRAIT.IMPROVISATION)
        ? Number(thiefBalanceProfile(context, PROFILE.improvisation)?.maximumStacks || 2)
        : 1;
  if (emitState) {
    emitStateSnapshot(
      context,
      'thief',
      context.effectiveEnd,
      'stolen-skill',
      snapshotThiefState(context.state.profession)
    );
  }
}

export function completeStealWithStoredSkills(
  context: ThiefCastContext,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  storeStolenSkillChoices(context, skillIds, forcedSkillId, false);
  applyStealCompletionTraits(context, context.effectiveEnd);
  emitStateSnapshot(context, 'thief', context.effectiveEnd, 'steal', snapshotThiefState(context.state.profession));
}

export function completeSteal(context: ThiefCastContext): void {
  completeStealWithStoredSkills(context, THIEF_STOLEN_SKILL_IDS);
}

export function consumeStoredStolenSkill(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  state.storedStolenSkillCount = Math.max(0, Number(state.storedStolenSkillCount || 0) - 1);
  if (state.storedStolenSkillCount > 0) {
    state.storedStolenSkillId = skill.id;
    state.storedStolenSkillIds = [skill.id];
  } else {
    state.storedStolenSkillId = null;
    state.storedStolenSkillIds = [];
  }

  emitStateSnapshot(
    context,
    'thief',
    context.effectiveEnd,
    'stolen-skill-used',
    snapshotThiefState(context.state.profession)
  );
}
