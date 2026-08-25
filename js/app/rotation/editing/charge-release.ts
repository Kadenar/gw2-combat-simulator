import {
  openChargeReleaseEditor,
  type ChargeReleaseEditorHandle,
  type ChargeReleaseEditorRow
} from '../../../platform/ui/rotation/editors/charge-release-editor.js';
import type { SchedulerRecord, Skill } from '../../../platform/engine/types.js';
import type { ProfessionAppState } from '../../profession/types.js';

/**
 * Coerces an untyped projection payload into validated editor rows. Each
 * candidate must carry finite `charges`/`at`/`delta`/`coefficient` (and a finite
 * or null `flowAfter`); malformed rows are dropped rather than shown.
 */
function editorRows(value: unknown): readonly ChargeReleaseEditorRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const row = candidate as SchedulerRecord;
    const charges = Number(row.charges);
    const at = Number(row.at);
    const delta = Number(row.delta);
    const coefficient = Number(row.coefficient);
    const flowAfter = row.flowAfter == null ? null : Number(row.flowAfter);
    return Number.isFinite(charges) &&
      Number.isFinite(at) &&
      Number.isFinite(delta) &&
      Number.isFinite(coefficient) &&
      (flowAfter == null || Number.isFinite(flowAfter))
      ? [
          {
            charges,
            at,
            delta,
            coefficient,
            flowAfter,
            disabled: Boolean(row.disabled),
            reason: String(row.reason || '')
          }
        ]
      : [];
  });
}

/**
 * Opens the charge-release editor for a charge-consuming skill (e.g. Dragon
 * Slash). Asks the profession UI to project the charge outcomes at the given
 * insertion index, validates the rows, and hands them to the shared editor;
 * `onApply` reports the chosen release-at-charges back to the caller.
 */
export function openDragonSlashReleaseEditor(options: {
  readonly app: ProfessionAppState;
  readonly anchor: HTMLElement;
  readonly skill: Skill;
  readonly insertionIndex: number;
  readonly currentReleaseAtCharges?: number | null;
  readonly onApply: (releaseAtCharges: number | undefined) => void;
}): ChargeReleaseEditorHandle {
  const rawProjection = options.app.profession.ui.chargeReleaseProjection({
    events: options.app.results?.events || [],
    insertionIndex: options.insertionIndex,
    skill: options.skill
  });
  const projection = rawProjection && typeof rawProjection === 'object' ? (rawProjection as SchedulerRecord) : {};
  return openChargeReleaseEditor({
    anchor: options.anchor,
    skillName: String(options.skill.displayName || options.skill.name),
    icon: options.skill.icon || undefined,
    currentReleaseAtCharges: options.currentReleaseAtCharges,
    rows: editorRows(projection.rows),
    unavailableMessage: String(projection.unavailableMessage || ''),
    onApply: options.onApply
  });
}
