import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { ProfessionCatalogContext } from '#gw2/platform/profession-presentation/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { engineerUiState } from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { selectedMechCommands } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerUiContext, EngineerUiSlice } from '#gw2/professions/engineer/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

// Prefer the editable build's traits, but fall back to simulation state when a
// historical result is inspected without a complete build projection.
function mechanistCommandSkills(context: EngineerUiContext & ProfessionCatalogContext): SkillId[] {
  const activeTraits = selectedTraits(context.catalog, context.build?.specializations || []);
  return activeTraits.length
    ? selectedMechCommands(new Set(activeTraits.map((trait) => trait.id)))
    : [...(engineerUiState(context)[STATE.MECH]?.commandSkillIds || [])];
}

export const mechanistUi: EngineerUiSlice = Object.freeze({
  /** Off excludes the signet bonus for testing; enabled bonuses retain native J-Drive scaling. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    for (const id of [ID.FORCE_SIGNET, ID.SUPERCONDUCTING_SIGNET]) {
      if (preview.skills.has(id))
        preview.add({
          key: `passive:${id}`,
          label: context.catalog.skillsById.get(id)!.name,
          group: 'Other buffs',
          kind: 'passive',
          skillId: id,
          scope: ['damage'],
          initial: 1,
          description: 'Damage bonus enabled, including selected J-Drive enhancement'
        });
    }

    return preview.controls;
  },
  paletteGroups: (context: EngineerUiContext & ProfessionCatalogContext) => [
    {
      id: 'engineer-profession',
      label: 'F',
      // The mech stays present, so the profession bar only exposes its three commands.
      skillIds: mechanistCommandSkills(context),
      color: '#b88a35',
      className: 'engineer-profession-skills',
      resourceAnchor: true,
      includeActionSkills: true
    }
  ]
});
