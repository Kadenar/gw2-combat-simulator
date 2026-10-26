import { DODGE_ICON } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Runtime, palette, and log reconstruction share the full dodge's airborne and landing phases. */
export const VINDICATOR_AIRBORNE_MS = 600;

export const VINDICATOR_LANDING_MS = 200;

export const VINDICATOR_DODGE_MS = VINDICATOR_AIRBORNE_MS + VINDICATOR_LANDING_MS;

/** Retain saved Dodge Jump identities for validation; Vindicator's modifySkillId executes the shared Dodge instead. */
export const VINDICATOR_DODGE_INPUT: Skill = Object.freeze({
  name: 'Dodge Jump',
  id: 23275,
  description: 'Perform the selected Vindicator dodge and landing.',
  icon: DODGE_ICON,
  type: 'Action',
  slot: 'Action',
  specialization: 'Vindicator',
  patchAuthoringExcluded: true,
  // Log replay still needs the input occupancy; costs and landing effects belong only to the resolved shared action.
  castTimeMs: VINDICATOR_DODGE_MS
});
