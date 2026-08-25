/** Builds the app-owned snapshot at the insertion cursor or rotation end. */
import type { RotationStateSnapshotItem } from '../../../platform/engine/types.js';
import { criticalChanceEventAt } from '../../../platform/gw2/results/query.js';
import { criticalChanceTooltip } from '../../../platform/ui/state-snapshot.js';
import type { ProfessionAppState } from '../../profession/types.js';
import { activeSpecialization, paletteEndState } from '../shared/context.js';

export function rotationStateSnapshot(app: ProfessionAppState): {
  readonly items: RotationStateSnapshotItem[];
  readonly atInsertion: boolean;
  readonly timeMs: number;
} {
  const result = app.results;
  const state = paletteEndState(app);
  const timeMs = Number(state?.time || 0);
  const rotationLength = app.build.rotation.length;
  const atInsertion = app.rotationInsertionIndex != null && app.rotationInsertionIndex !== rotationLength;

  const items: RotationStateSnapshotItem[] = [];
  const criticalEvent = criticalChanceEventAt(result, timeMs);
  if (criticalEvent) {
    const critical = Number(criticalEvent.criticalChance);
    const heading = atInsertion
      ? 'Critical strike chance of the next strike at the insertion point'
      : 'Critical strike chance of the last strike in the rotation';
    items.push({
      id: 'critical-chance',
      label: 'Crit chance',
      value: `${Math.round(critical * 100)}%`,
      title: criticalChanceTooltip(criticalEvent, heading)
    });
  }

  items.push(
    ...app.profession.ui.rotationStateSnapshot({
      specialization: activeSpecialization(app),
      professionState: state?.profession,
      atSeconds: timeMs / 1000,
      build: app.build,
      result
    })
  );
  return { items, atInsertion, timeMs };
}
