import { WEAPON } from '#gw2/platform/constants.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

/** Give weapon and elite damage bonuses one shared target-health input during UI composition. */
export const rangerFamilyUi: Partial<ProfessionUiContract> = {
  previewControls(context) {
    const preview = createPreviewControls(context);
    preview.damageTargetHealth(
      context.weapons[0] === WEAPON.SPEAR ||
        (context.specialization === 'Soulbeast' && preview.hasId(TRAIT.OPPRESSIVE_SUPERIORITY))
    );
    return preview.controls;
  }
};
