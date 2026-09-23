import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export type AmalgamMorphKind = 'cleanse' | 'protect' | 'thorns' | 'demolish' | 'obliterate' | 'pierce' | 'shred';

// Each selectable protocol variant maps to one stable behavior kind regardless of its display label.
export const AMALGAM_MORPH_KIND_BY_SKILL_ID: ReadonlyMap<SkillId, AmalgamMorphKind> = new Map([
  [ID.DEFENSIVE_PROTOCOL_CLEANSE, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_THORNS, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163, 'thorns'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_SHRED, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103, 'shred']
]);
