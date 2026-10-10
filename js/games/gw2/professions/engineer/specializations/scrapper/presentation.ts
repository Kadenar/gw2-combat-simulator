import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { engineerToolbeltSkillIds, uniqueSkillIds } from '#gw2/professions/engineer/core/presentation.js';
import type { EngineerSkill, EngineerUiContext, EngineerUiSlice } from '#gw2/professions/engineer/types.js';

// First 4 toolbelt slots + Function Gyro as the F5 mechanic skill.
function scrapperProfessionSkills(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, context: EngineerUiContext) {
  return [...engineerToolbeltSkillIds(catalog, context).slice(0, 4), ID.FUNCTION_GYRO];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindScrapperUi(catalog: Readonly<CanonicalCatalog<EngineerSkill>>): EngineerUiSlice {
  return Object.freeze({
    /** Expose held combat bonuses without changing the saved build or simulation. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      preview.boon('stability', 'Object in Motion');
      preview.boon('swiftness', 'Object in Motion');
      preview.damageBuff('Object in Motion', 'superspeed', 'superspeed');
      return preview.controls;
    },
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: 'engineer-profession',
        label: 'F',
        skillIds: uniqueSkillIds(
          catalog,
          scrapperProfessionSkills(catalog, context).filter((id) => id != null)
        ),
        color: '#b88a35',
        className: 'engineer-profession-skills',
        resourceAnchor: true,
        includeActionSkills: true
      }
    ]
  });
}
