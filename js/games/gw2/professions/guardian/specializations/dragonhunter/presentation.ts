import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIds,
  guardianUiState
} from '#gw2/professions/guardian/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { GuardianUiContext, GuardianUiSlice, GuardianSkill } from '#gw2/professions/guardian/types.js';

const VIRTUE_IDS = Object.freeze([
  GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE,
  GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE,
  GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE
]);

/** Shows the target tether only while Big Game Hunter can still benefit from it. */
function dragonhunterStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const remaining = (guardianUiState(context).tetherUntil || 0) - guardianSnapshotAt(context);
  return remaining > 0
    ? [
        {
          id: 'dragonhunter-tether',
          label: 'Spear of Justice',
          value: formatSecondsRemaining(remaining),
          title: 'Dragonhunter tether remaining on the target'
        }
      ]
    : [];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindDragonhunterUi(catalog: Readonly<CanonicalCatalog<GuardianSkill>>): GuardianUiSlice {
  return Object.freeze({
    rotationStateSnapshot: dragonhunterStateSnapshot,
    paletteGroups: (context: GuardianUiContext) => [
      {
        id: 'profession',
        label: 'F',
        skillIds: guardianUiSkillIds(catalog, VIRTUE_IDS, context),
        color: '#2f7eb8',
        resourceAnchor: true // anchors the virtue tether/resource bar to this palette group
      }
    ]
  });
}
