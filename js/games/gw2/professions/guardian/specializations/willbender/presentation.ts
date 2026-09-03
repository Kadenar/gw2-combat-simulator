import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiState
} from '#gw2/professions/guardian/core/presentation.js';
import type {
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem,
  SchedulerRecord
} from '#gw2/platform/engine/types.js';
import type { GuardianResolverEvent, GuardianUiContext } from '#gw2/professions/guardian/types.js';

function willbenderEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type.startsWith('guardian.willbender-')) return null; // null = explicitly suppress; internal scheduler events should not appear in the log
  return undefined; // undefined = defer to the default renderer for all other event types
}

const VIRTUE_NAMES = Object.freeze(['Rushing Justice', 'Flowing Resolve', 'Crashing Courage']);

/** Reports active virtue flames and Lethal Tempo so Willbender follow-up timing is inspectable. */
function willbenderStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const state = guardianUiState(context);
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  for (const [id, label, expiresAt] of [
    ['willbender-rushing-justice', 'Rushing Justice', Number(state.justiceUntil || 0)],
    ['willbender-flowing-resolve', 'Flowing Resolve', Number(state.resolveUntil || 0)],
    ['willbender-crashing-courage', 'Crashing Courage', Number(state.courageUntil || 0)]
  ] as const) {
    const remaining = expiresAt - at;
    if (remaining <= 0) continue;
    items.push({ id, label, value: formatSecondsRemaining(remaining), title: `${label} active window` });
  }

  const lethalRemaining = Number(state.lethalTempoUntil || 0) - at;
  const lethalStacks = Math.max(0, Math.min(5, Math.trunc(Number(state.lethalTempoStacks || 0))));
  if (lethalRemaining > 0 && lethalStacks > 0) {
    items.push({
      id: 'willbender-lethal-tempo',
      label: 'Lethal Tempo',
      value: `${lethalStacks}/5 · ${formatSecondsRemaining(lethalRemaining)}`,
      title: 'Active Lethal Tempo stacks and time remaining'
    });
  }

  return items;
}

export const willbenderUi = Object.freeze({
  eventLogRow: willbenderEventLogRow,
  rotationStateSnapshot: willbenderStateSnapshot,
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
      resourceAnchor: true
    }
  ]
});
