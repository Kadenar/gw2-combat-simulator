/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.COUNTERATTACK, followUpId: ID.COUNTERATTACK_KICK },
  { parentId: ID.SUN_SPIRIT, followUpId: ID.SOLAR_FLARE },
  { parentId: ID.STORM_SPIRIT, followUpId: ID.CALL_LIGHTNING },
  { parentId: ID.STONE_SPIRIT, followUpId: ID.QUAKE },
  { parentId: ID.FROST_SPIRIT, followUpId: ID.COLD_SNAP },
  { parentId: ID.SPIRIT_OF_NATURE, followUpId: ID.NATURES_RENEWAL },
  { parentId: ID.WATER_SPIRIT, followUpId: ID.AQUA_SURGE },
  { parentId: ID.MONGOOSES_FRENZY, followUpId: ID.WOLFS_ONSLAUGHT },
  { parentId: ID.FALCONS_STOOP, followUpId: ID.OWLS_FLIGHT },
  { parentId: ID.WARCLAWS_ENGAGE, followUpId: ID.PREDATORS_AMBUSH },
  { parentId: ID.PANTHERS_PROWL, followUpId: ID.SPIDERS_WEB }
]);
