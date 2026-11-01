/** Explicit ordered chains owned by Holosmith engineer; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_HOLOSMITH_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.SUN_EDGE, ID.SUN_RIPPER, ID.GLEAM_SABER],
  [ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.FLASH_CUTTER],
  [ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM]
]);
