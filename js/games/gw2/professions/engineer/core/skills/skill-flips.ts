/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.HEALING_TURRET, followUpId: ID.DETONATE_HEALING_TURRET },
  { parentId: ID.STATIC_SHIELD, followUpId: ID.THROW_SHIELD },
  { parentId: ID.MED_KIT, followUpId: ID.STOW_MED_KIT },
  { parentId: ID.GRENADE_KIT, followUpId: ID.STOW_GRENADE_KIT },
  { parentId: ID.BOMB_KIT, followUpId: ID.STOW_BOMB_KIT },
  { parentId: ID.ELIXIR_GUN, followUpId: ID.STOW_ELIXIR_GUN },
  { parentId: ID.MAGNETIC_SHIELD, followUpId: ID.MAGNETIC_INVERSION },
  { parentId: ID.THROW_MINE, followUpId: ID.DETONATE },
  { parentId: ID.DEVASTATOR, followUpId: ID.FOCUSED_DEVASTATION },
  { parentId: ID.LIGHTNING_ROD, followUpId: ID.ELECTRIC_ARTILLERY },
  { parentId: ID.HEALING_TURRET, followUpId: ID.CLEANSING_BURST, defaultFollowUp: false },
  { parentId: ID.FLAMETHROWER, followUpId: ID.STOW_FLAMETHROWER },
  { parentId: ID.ELITE_MORTAR_KIT, followUpId: ID.STOW_ELITE_MORTAR_KIT }
]);
