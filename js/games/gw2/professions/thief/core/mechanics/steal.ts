import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { applyStealCompletionTraits } from '#gw2/professions/thief/core/traits/index.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { ThiefCastContext, ThiefCoreState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';

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
        ? Number(balanceProfileFromContext(context, PROFILE.improvisation)?.maximumStacks || 2)
        : 1;
  if (emitState) {
    emitThiefStateSnapshot(context, context.effectiveEnd, 'stolen-skill');
  }
}

export function completeStealWithStoredSkills(
  context: ThiefCastContext,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  storeStolenSkillChoices(context, skillIds, forcedSkillId, false);
  applyStealCompletionTraits(context, context.effectiveEnd);
  emitThiefStateSnapshot(context, context.effectiveEnd, 'steal');
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

  emitThiefStateSnapshot(context, context.effectiveEnd, 'stolen-skill-used');
}
