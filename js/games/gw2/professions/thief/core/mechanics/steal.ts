import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  stealCommitted,
  stealCompleted,
  type StealCompletion
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
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

/** Run the committed skill's effect after on-steal traits and before completion rewards. */
export function commitThiefSteal(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  applySkillEffect: () => void,
  completion: StealCompletion = {}
): void {
  runtime.fireTrigger(stealCommitted, { cast });
  applySkillEffect();
  runtime.fireTrigger(stealCompleted, completion);
}

/** Using a stored skill spends one use; a remaining Improvisation use stays locked to the same skill. */
export function consumeThiefStolenSkill(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  core.storedStolenSkillCount = Math.max(0, (core.storedStolenSkillCount || 0) - 1);
  core.storedStolenSkillIds = core.storedStolenSkillCount > 0 ? [skill.id] : [];
}
