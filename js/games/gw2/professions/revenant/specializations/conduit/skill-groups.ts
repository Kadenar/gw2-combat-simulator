import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

// Twin Moon Sweep exists under two different skill IDs in the catalog; both must be excluded from Mistfire.
export const TWIN_MOON_SKILL_IDS = new Set<SkillId>([ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001]);

// Both API button identities share main/follow-up resonance, charges, and the follow-up Energy waiver.
export const BEGUILING_HAZE_SKILL_IDS = new Set<SkillId>([ID.BEGUILING_HAZE, ID.BEGUILING_HAZE_ID_76805]);
