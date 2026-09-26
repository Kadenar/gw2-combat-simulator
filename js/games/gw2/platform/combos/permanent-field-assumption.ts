import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { ComboFieldEvent, ComboFieldType } from '#gw2/platform/combos/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

const PERMANENT_COMBO_FIELD_ASSUMPTION_KEYS = Object.freeze({
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

/** Build the configured field once so either execution entry uses the same owner, lifetime, and binding priority. */
export function permanentComboFieldAssumption(
  config: Gw2Config,
  ownerId: string,
  at: number
): ComboFieldEvent | undefined {
  const fieldType = config.professionAssumptions?.[PERMANENT_COMBO_FIELD_ASSUMPTION_KEYS.FIELD_TYPE];
  if (typeof fieldType !== 'string' || fieldType === NONE) return;

  // Finishers only bind to fields sharing their owner id, so the assumption must own its
  // field as the active profession — the same convention every profession's own finishers use.
  const fieldId = `${ownerId}:assumption:permanent-combo-field:${fieldType}`;
  return {
    type: 'combo_field',
    at,
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
  };
}
