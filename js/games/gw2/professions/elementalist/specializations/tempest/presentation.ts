import type { ElementalistUiContext, ElementalistUiSlice } from '#gw2/professions/elementalist/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
/**
 * Tempest UI contract: groups the four overloads on the rotation palette, and
 * previews overload availability so the editor can grey out casts the scheduler would reject.
 */
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';

import { ELEMENTALIST_OVERLOAD_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';

/** Show only buffs already granted at the cursor, retaining Aria's aura-driven extensions. */
function tempestStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const at = context.atSeconds || 0;
  const items: RotationStateSnapshotItem[] = [];
  const transcendent = timedBuffAt(context.result, 'transcendent-tempest', at);
  if (transcendent) {
    items.push({
      id: 'transcendent-tempest',
      label: 'Transcendent Tempest',
      value: `${transcendent.remaining.toFixed(1)}s`
    });
  }

  // Read the refreshed engine deadline instead of replaying trait announcements.
  const aria = timedBuffAt(context.result, 'tempestuous aria', at);
  if (aria) items.push({ id: 'tempestuous-aria', label: 'Tempestuous Aria', value: aria.remaining.toFixed(1) + 's' });
  return items;
}

/** Presentation fragment the Tempest module contributes to the elementalist UI contract. */
export const tempestUi: ElementalistUiSlice = Object.freeze({
  /** Hold the native outgoing-damage windows independently of the Attribute Preview. */
  previewControls(context) {
    const preview = createPreviewControls(context);
    for (const [name, key, field] of [
      ['Tempestuous Aria', 'tempestuousAria', 'tempestuous aria'],
      ['Transcendent Tempest', 'transcendentTempest', 'transcendent-tempest']
    ])
      preview.trait(name, {
        key,
        kind: 'buff',
        field,
        scope: ['damage'],
        description: 'Outgoing damage window active'
      });
    return preview.controls;
  },
  rotationStateSnapshot: tempestStateSnapshot,
  paletteGroups: () => [
    {
      id: 'elementalist-tempest-overloads',
      label: 'OL',
      skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
      color: '#cf6c42',
      resourceAnchor: true,
      order: -10
    }
  ]
});
