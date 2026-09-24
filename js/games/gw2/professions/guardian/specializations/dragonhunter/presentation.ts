import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiState
} from '#gw2/professions/guardian/core/presentation.js';
import type {
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { GuardianResolverEvent, GuardianUiContext, GuardianUiSlice } from '#gw2/professions/guardian/types.js';

function dragonhunterEventLogRow(
  _context: GuardianUiContext,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  // null = explicit suppression (hide from log); undefined = no opinion (let platform decide)
  if (event.type.startsWith('guardian.dragonhunter-')) return null;
  return undefined;
}

const VIRTUE_NAMES = Object.freeze(['Spear of Justice', 'Wings of Resolve', 'Shield of Courage']);

/** Shows the target tether only while Big Game Hunter can still benefit from it. */
function dragonhunterStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const remaining = Number(guardianUiState(context).tetherUntil || 0) - guardianSnapshotAt(context);
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
export function bindDragonhunterUi(catalog: Readonly<CanonicalCatalog>): GuardianUiSlice {
  return Object.freeze({
    eventLogRow: dragonhunterEventLogRow,
    rotationStateSnapshot: dragonhunterStateSnapshot,
    paletteGroups: (context: GuardianUiContext) => [
      {
        id: 'profession',
        label: 'F',
        skillIds: guardianUiSkillIdsByName(catalog, VIRTUE_NAMES, context),
        color: '#2f7eb8',
        resourceAnchor: true // anchors the virtue tether/resource bar to this palette group
      }
    ]
  });
}
