import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import {
  engineerToolbeltSkillIds,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/professions/engineer/core/presentation.js';
import type { EngineerUiContext, EngineerUiSlice } from '#gw2/professions/engineer/types.js';

// First 4 toolbelt slots + Function Gyro as the F5 mechanic skill.
function scrapperProfessionSkills(catalog: Readonly<CanonicalCatalog>, context: EngineerUiContext) {
  return [...engineerToolbeltSkillIds(catalog, context).slice(0, 4), namedSkillId(catalog, 'Function Gyro')];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindScrapperUi(catalog: Readonly<CanonicalCatalog>): EngineerUiSlice {
  return Object.freeze({
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: 'engineer-profession',
        label: 'F',
        skillIds: uniqueIdsBySkillName(
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
