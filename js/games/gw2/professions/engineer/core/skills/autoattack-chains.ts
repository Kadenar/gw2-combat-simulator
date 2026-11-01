/** Explicit ordered chains owned by Core engineer; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

export const ENGINEER_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.POSITIVE_STRIKE, ID.NEGATIVE_BASH, ID.EQUALIZING_BLOW],
  [ID.MACE_STRIKE, ID.MACE_SMASH, ID.MACE_BLAST],
  [ID.SUN_EDGE_NON_HOLOSMITH, ID.SUN_RIPPER_NON_HOLOSMITH, ID.GLEAM_SABER_NON_HOLOSMITH],
  [ID.PUNCTURING_JAB, ID.RENDING_STRIKE, ID.AMPLIFYING_SLICE]
]);
