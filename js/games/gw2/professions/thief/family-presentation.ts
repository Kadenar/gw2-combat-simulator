import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';

/** Share the starting pip's appearance; each active module owns its eligibility and inventory count. */
export function preStealResourceView(uses: number): ProfessionResourceView {
  return {
    id: 'pre-steal',
    singular: 'pre-steal',
    plural: 'pre-steal',
    maximum: 1,
    value: Number(uses > 0),
    canStart: true,
    buildKey: 'initialPreSteal',
    step: 1,
    displayMode: 'pips',
    showInPalette: false,
    shortLabel: 'Pre-steal',
    statusLabel: 'Current'
  };
}
