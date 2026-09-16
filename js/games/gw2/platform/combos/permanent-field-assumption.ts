import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { ComboFieldType } from '#gw2/platform/combos/types.js';
import type { SchedulerContext } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export const PERMANENT_COMBO_FIELD_ASSUMPTION_KEYS = Object.freeze({
  FIELD_TYPE: 'permanentComboField'
});

const NONE = 'none';

const FIELD_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: NONE, label: 'None' },
  { value: 'Dark', label: 'Dark' },
  { value: 'Ethereal', label: 'Ethereal' },
  { value: 'Fire', label: 'Fire' },
  { value: 'Ice', label: 'Ice' },
  { value: 'Light', label: 'Light' },
  { value: 'Lightning', label: 'Lightning' },
  { value: 'Poison', label: 'Poison' },
  { value: 'Smoke', label: 'Smoke' },
  { value: 'Water', label: 'Water' }
];

/** Profession-agnostic testing assumption: keep one combo field of the chosen type up for the whole fight. */
export const PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS: ReadonlyArray<ProfessionAssumptionControl> =
  createProfessionAssumptionControls([
    {
      key: PERMANENT_COMBO_FIELD_ASSUMPTION_KEYS.FIELD_TYPE,
      label: 'Permanent combo field (testing)',
      type: 'select',
      defaultValue: NONE,
      section: 'simulation',
      options: FIELD_TYPE_OPTIONS
    }
  ]);

export const DEFAULT_PERMANENT_COMBO_FIELD_ASSUMPTIONS: Readonly<Record<string, unknown>> = Object.freeze(
  Object.fromEntries(PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS.map((control) => [control.key, control.defaultValue]))
);

// Far-future sentinel so the assumption field is never reclaimed during a normal simulation run.
const ASSUMED_FIELD_EXPIRES_AT = 1_000_000_000;

/** Emits the permanent combo field selected by the profession-agnostic assumption, once per run. */
export function ensurePermanentComboFieldAssumption<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  event: SimulationEvent
): void {
  const fieldType = (context.config as Gw2Config)?.professionAssumptions?.[
    PERMANENT_COMBO_FIELD_ASSUMPTION_KEYS.FIELD_TYPE
  ];
  if (typeof fieldType !== 'string' || fieldType === NONE) return;

  // Finishers only bind to fields sharing their owner id, so the assumption must own its
  // field as the active profession — the same convention every profession's own finishers use.
  const ownerId = context.profession.id;
  const fieldId = `${ownerId}:assumption:permanent-combo-field:${fieldType}`;
  // Guard is idempotent: the field must be emitted only once regardless of how many events trigger the hook.
  if (context.eventsOfType('combo_field').some((candidate) => candidate.fieldId === fieldId)) return;

  context.emitDerived(event, {
    type: 'combo_field',
    at: event.at,
    source: 'Permanent combo field assumption',
    sourceId: 'assumption.permanent-combo-field',
    actorType: 'effect',
    skillName: 'Permanent combo field assumption',
    fieldId,
    fieldType: fieldType as ComboFieldType,
    expiresAt: ASSUMED_FIELD_EXPIRES_AT,
    ownerId,
    ownerActorType: 'player',
    // Priority 1 ensures this assumption field wins over any zero-priority real fields when both overlap.
    comboBindingPriority: 1
  });
}
