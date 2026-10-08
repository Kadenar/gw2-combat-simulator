import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { improvisationStolenUses } from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import { applyKleptomaniac } from '#gw2/professions/thief/core/traits/trickery/steal.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Each base Steal offers the same three supported stolen skills for the user to choose from.
export const THIEF_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.DETONATE_PLASMA,
  ID.THROW_MAGNETIC_BOMB,
  ID.SOUL_STONE_VENOM
]);

/** The stolen skills currently selectable: the whole pool, or the one skill locked by a forced grant or reuse. */
export function storedStolenSkillChoices(
  state: ReadonlyMechanicState<
    Pick<ThiefCoreState, 'storedStolenSkillId' | 'storedStolenSkillIds' | 'storedStolenSkillCount'>
  >
): readonly SkillId[] {
  if ((state.storedStolenSkillCount || 0) <= 0) return [];
  return state.storedStolenSkillId == null ? state.storedStolenSkillIds : [state.storedStolenSkillId];
}

/** A steal grants a choice pool; Improvisation allows a second use of the selected skill. */
export function storeThiefStolenSkillChoices(
  runtime: ThiefRuntime,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  const core = runtime.profession.core;
  const choices = [...new Set(skillIds.map(Number).filter(Number.isFinite))];
  core.storedStolenSkillIds = choices;
  core.storedStolenSkillId = forcedSkillId;
  core.storedStolenSkillCount = choices.length === 0 ? 0 : improvisationStolenUses(runtime);
}

/** Stores the steal's choices and grants Core's on-steal initiative; specializations add theirs afterwards. */
export function completeThiefSteal(
  runtime: ThiefRuntime,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  storeThiefStolenSkillChoices(runtime, skillIds, forcedSkillId);
  applyKleptomaniac(runtime);
}

/** Using a stored skill spends one use; a remaining Improvisation use stays locked to the same skill. */
export function consumeThiefStolenSkill(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  core.storedStolenSkillCount = Math.max(0, (core.storedStolenSkillCount || 0) - 1);
  core.storedStolenSkillId = core.storedStolenSkillCount > 0 ? skill.id : null;
  core.storedStolenSkillIds = core.storedStolenSkillCount > 0 ? [skill.id] : [];
}
