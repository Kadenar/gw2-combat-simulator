import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

/** Coordinate shared shroud inputs and condition counts across Core and the selected elite. */
export const necromancerFamilyUi: Partial<ProfessionUiContract> = {
  previewControls(context) {
    const preview = createPreviewControls(context);
    if (context.specialization !== 'Scourge') {
      const sources = ['Death Perception', "Reaper's Onslaught"].filter((name) => preview.has(name));
      if (preview.skills.has(ID.SIGNET_OF_SPITE)) sources.push('Signet of Spite');
      if (sources.length)
        preview.add({
          key: 'shroud',
          label: 'Shroud',
          group: 'Trait conditionals',
          kind: 'special',
          description: sources.join(', ')
        });
    }

    // Count only condition kinds exposed by the selected loadout, including elite-owned controls.
    const namedConditions = Number(preview.has('Wicked Corruption')) + Number(preview.has('Decimate Defenses'));
    preview.trait('Target the Weak', {
      key: 'targetTheWeak',
      kind: 'conditionCount',
      max: CANONICAL_TARGET_CONDITIONS.length - namedConditions,
      description: namedConditions ? 'Other condition types; Critical Chance' : 'Condition types; Critical Chance'
    });

    return preview.controls;
  }
};
