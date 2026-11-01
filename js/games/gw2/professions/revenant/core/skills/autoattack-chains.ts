/** Explicit ordered chains owned by Core revenant; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const REVENANT_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.MISERY_SWIPE, ID.ANGUISH_SWIPE, ID.MANIFEST_TOXIN],
  [ID.PREPARATION_THRUST, ID.BRUTAL_BLADE, ID.RIFT_SLASH],
  [ID.RAPID_SWIPE, ID.FORCEFUL_BASH, ID.REJUVENATING_ASSAULT],
  [ID.MIST_SWING, ID.MIST_SLASH, ID.ARCING_MISTS],
  [ID.SERENE_SLASH, ID.ACERBIC_CUT, ID.MOTIVATING_WHIRL]
]);
