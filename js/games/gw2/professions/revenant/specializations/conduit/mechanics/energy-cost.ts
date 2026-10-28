import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Only these canonical Demon skills use Mesmer form costs; other skills retain their native costs. */
const MESMER_FORM_COSTS: ReadonlySet<SkillId> = new Set([
  ID.EMPOWERING_MISERY,
  ID.PAIN_ABSORPTION,
  ID.BANISH_ENCHANTMENT,
  ID.CALL_TO_ANGUISH,
  ID.UNYIELDING_IMPACT,
  ID.EMBRACE_THE_DARKNESS
]);

/** Reject malformed form costs on entry even when score output never queries the affected skill. */
export function validateConduitMesmerEnergyCosts(catalog: CanonicalCatalog): void {
  for (const skillId of MESMER_FORM_COSTS.values()) {
    skillNumberFromContext({ catalog }, skillId, 'mesmerEnergyCost');
  }
}

/** Identifies Beguiling Haze follow-ups so only their temporary charges waive the skill's Energy cost. */
function isBeguilingHazeFollowUp(state: Partial<ConduitState>, skill: RevenantSkill): boolean {
  return skill.id === ID.BEGUILING_HAZE && (state.beguilingHazeCharges || 0) > 0;
}

/** Resolve active form costs from the selected catalog, after free upkeep and follow-up rules. */
export function applyConduitEnergyCostRules(
  { state, time, catalog }: RevenantEnergyCostInput,
  skill: RevenantSkill,
  baseCost: number
): number {
  if (baseCost <= 0) return 0;

  // Temporary charges select the follow-up's own cost before any form-specific pricing.
  if (isBeguilingHazeFollowUp(state, skill))
    return Math.max(0, skillNumberFromContext({ catalog }, ID.BEGUILING_HAZE_FOLLOW_UP, 'energyCost'));

  // The exclusive deadline also governs queries before queued form-expiry work runs.
  if (!revenantConduitFormIsActive(state, 'Mesmer', time)) return baseCost;

  if (!MESMER_FORM_COSTS.has(skill.id)) return baseCost;

  return Math.max(0, skillNumberFromContext({ catalog }, skill.id, 'mesmerEnergyCost'));
}
