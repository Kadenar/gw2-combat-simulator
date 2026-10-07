import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { BEGUILING_HAZE_SKILL_IDS } from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';

/** Only these canonical Demon skills use Mesmer cost profiles; other skills retain their native costs. */
const MESMER_FORM_COSTS: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.EMPOWERING_MISERY, PROFILE.mesmerEmpoweringMisery],
  [ID.PAIN_ABSORPTION, PROFILE.mesmerPainAbsorption],
  [ID.BANISH_ENCHANTMENT, PROFILE.mesmerBanishEnchantment],
  [ID.CALL_TO_ANGUISH, PROFILE.mesmerCallToAnguish],
  [ID.UNYIELDING_IMPACT, PROFILE.mesmerUnyieldingImpact],
  [ID.EMBRACE_THE_DARKNESS, PROFILE.mesmerEmbraceTheDarkness]
]);

/** Reject malformed form costs on entry even when score output never queries the affected skill. */
export function validateConduitMesmerEnergyCosts(catalog: CanonicalCatalog): void {
  for (const profileId of MESMER_FORM_COSTS.values()) {
    balanceProfileNumber(requireBalanceProfileFromContext({ catalog }, profileId), 'energyCost');
  }
}

/** Identifies Beguiling Haze follow-ups so only their temporary charges waive the skill's Energy cost. */
function isBeguilingHazeFollowUp(state: Partial<ConduitState>, skill: RevenantSkill): boolean {
  return BEGUILING_HAZE_SKILL_IDS.has(skill.id) && (state.beguilingHazeCharges || 0) > 0;
}

/** Resolve active form costs from the selected catalog, after free upkeep and follow-up rules. */
export function applyConduitEnergyCostRules(
  { state, time, catalog }: RevenantEnergyCostInput,
  skill: RevenantSkill,
  baseCost: number
): number {
  if (baseCost <= 0) return 0;
  if (isBeguilingHazeFollowUp(state, skill)) return 0;

  // The exclusive deadline also governs queries before queued form-expiry work runs.
  if (!revenantConduitFormIsActive(state, 'Mesmer', time)) return baseCost;
  const profileId = MESMER_FORM_COSTS.get(skill.id);
  if (profileId === undefined) return baseCost;
  return Math.max(0, balanceProfileNumber(requireBalanceProfileFromContext({ catalog }, profileId), 'energyCost'));
}
