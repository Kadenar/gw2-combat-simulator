import { WEAPON } from '#gw2/platform/constants.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

/** Expose target health for the spear damage bonus. */
export const rangerFamilyUi: Partial<ProfessionUiContract> = {
  previewControls(context) {
    const preview = createPreviewControls(context);
    preview.damageTargetHealth(context.weapons[0] === WEAPON.SPEAR);
    return preview.controls;
  }
};
