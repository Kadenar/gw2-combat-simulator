/** Builds the app-owned snapshot at the insertion cursor or rotation end. */
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/profession/types.js';
import { criticalChanceEventAt } from '#gw2/platform/results/query.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { activeSpecialization, paletteEndState } from '#gw2/app/rotation/shared/context.js';

function percent(value: number, signed = false): string {
  const numeric = Number(value || 0) * 100;
  const rounded = numeric
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
  return `${signed && numeric > 0 ? '+' : ''}${rounded}%`;
}

/** Formats critical-chance contributors and cap behavior for snapshot hover text. */
export function criticalChanceTooltip(event: Gw2ResolverEvent, heading: string): string {
  const lines = [heading];
  for (const [index, contributor] of (event.criticalChanceContributors || []).entries()) {
    lines.push(`${contributor.label}: ${percent(contributor.amount, index > 0)}`);
  }

  const finalChance = Number(event.criticalChance || 0);
  const beforeCap = Number(event.criticalChanceBeforeCap ?? finalChance);
  if (Math.abs(beforeCap - finalChance) > 1e-12) {
    lines.push(`Before cap: ${percent(beforeCap)}`);
  }

  lines.push(`Final: ${percent(finalChance)}`);
  return lines.join('\n');
}

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
