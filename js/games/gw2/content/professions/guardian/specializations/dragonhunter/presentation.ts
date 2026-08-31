import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiState
} from '#gw2/content/professions/guardian/core/presentation.js';
import type {
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem,
  SchedulerRecord
} from '#gw2/platform/engine/types.js';
import type { GuardianResolverEvent, GuardianUiContext } from '#gw2/content/professions/guardian/types.js';

function dragonhunterEventLogRow(
  _context: SchedulerRecord,
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

export const dragonhunterUi = Object.freeze({
  eventLogRow: dragonhunterEventLogRow,
  rotationStateSnapshot: dragonhunterStateSnapshot,
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: 'guardian-f-keys',
      label: 'F Keys',
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: '#2f7eb8'
    }
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: 'profession',
      label: 'F',
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: '#2f7eb8',
      resourceAnchor: true // anchors the virtue tether/resource bar to this palette group
    }
  ]
});
