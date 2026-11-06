import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { stealCompleted } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { improvisationStolenUses } from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** The stolen skills currently selectable: the whole pool, or the one skill locked by a forced grant or reuse. */
export function storedStolenSkillChoices(
  state: ReadonlyMechanicState<Pick<ThiefCoreState, 'storedStolenSkillIds' | 'storedStolenSkillCount'>>
): readonly SkillId[] {
  if ((state.storedStolenSkillCount || 0) <= 0) return [];

  return state.storedStolenSkillIds;
}

/** A steal grants a choice pool; Improvisation allows a second use of the selected skill. */
export function storeThiefStolenSkillChoices(runtime: ThiefRuntime, skillIds: readonly SkillId[]): void {
  const core = runtime.profession.core;
  const choices = [...new Set(skillIds.map(Number).filter(Number.isFinite))];
  core.storedStolenSkillIds = choices;
  core.storedStolenSkillCount = choices.length === 0 ? 0 : improvisationStolenUses(runtime.helpers, runtime);
}

/** Stores the steal's choices and grants Core's on-steal initiative; specializations add theirs afterwards. */
export function completeThiefSteal(runtime: ThiefRuntime, skillIds: readonly SkillId[]): void {
  storeThiefStolenSkillChoices(runtime, skillIds);
  runtime.fireTrigger(stealCompleted, {});
}

/** Using a stored skill spends one use; a remaining Improvisation use stays locked to the same skill. */
export function consumeThiefStolenSkill(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  core.storedStolenSkillCount = Math.max(0, (core.storedStolenSkillCount || 0) - 1);
  core.storedStolenSkillIds = core.storedStolenSkillCount > 0 ? [skill.id] : [];
}
