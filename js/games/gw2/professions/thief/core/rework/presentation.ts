import { CONDITION } from '#gw2/platform/constants.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

/** Detached previews hold an earned Twin Fangs window, independently of the simulated target's position. */
export const thiefCoreReworkUi = {
  ...thiefCoreUi,
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.buff('Twin Fangs', 'twinFangs', 'twin-fangs', 'Earned critical-chance bonus active');
    for (const condition of [CONDITION.CRIPPLED, CONDITION.CHILLED, CONDITION.IMMOBILIZED])
      preview.condition(condition, 'Opportune Opening');
    return [
      ...thiefCoreUi.previewControls(context).filter((control) => control.key !== 'flanking'),
      ...preview.controls
    ];
  }
};
