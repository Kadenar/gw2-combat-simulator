/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.ILLUSIONARY_COUNTER, followUpId: ID.COUNTERSPELL },
  { parentId: ID.MANTRA_OF_PAIN, followUpId: ID.POWER_SPIKE },
  { parentId: ID.MANTRA_OF_RECOVERY, followUpId: ID.POWER_RETURN },
  { parentId: ID.SINGULARITY_SHOT, followUpId: ID.DIMENSIONAL_APERTURE },
  { parentId: ID.INSPIRING_IMAGERY, followUpId: ID.ABSTRACTION },
  { parentId: ID.TEMPORAL_CURTAIN, followUpId: ID.INTO_THE_VOID },
  { parentId: ID.ILLUSIONARY_RIPOSTE, followUpId: ID.COUNTER_BLADE },
  { parentId: ID.ILLUSIONARY_LEAP, followUpId: ID.SWAP },
  { parentId: ID.SWAP, followUpId: ID.DISENCHANT }
]);
