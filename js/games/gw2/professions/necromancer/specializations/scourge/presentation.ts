import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerUiState
} from '#gw2/professions/necromancer/core/presentation.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { NecromancerSkill, NecromancerUiContext } from '#gw2/professions/necromancer/types.js';

const SCOURGE_SKILLS = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD
]);

// Prevent the palette from offering the inactive side of Herald of Sorrow's F5 replacement.
function scourgePaletteAvailability(context: NecromancerUiContext, skill: NecromancerSkill): PaletteSkillAvailability {
  const activeTraitNames = new Set(getActiveTraits(context.build?.specializations || []).map((trait) => trait.name));
  if (skill.id === ID.SANDSTORM_SHROUD && !activeTraitNames.has('Herald of Sorrow')) {
    return { available: false, message: 'Requires Herald of Sorrow' };
  }

  if (skill.id === ID.DESERT_SHROUD && activeTraitNames.has('Herald of Sorrow')) {
    return {
      available: false,
      message: 'Replaced by Sandstorm Shroud'
    };
  }

  return { available: true, message: '' };
}

export const scourgeUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: NecromancerUiContext) =>
    necromancerTransformPaletteGroups(context, {
      professionSkillIds: SCOURGE_SKILLS
    }),
  resourceViews: (context: NecromancerUiContext): ProfessionResourceView[] => [
    ...necromancerSoulShardResourceViews(context),
    {
      id: 'active-shades',
      singular: 'active shade',
      plural: 'active shades',
      // Hard-coded at 3 even with Sand Savant; Sand Savant trades count for power but
      // the resource display cap stays at 3 pips to keep the UI consistent
      maximum: 3,
      // shades array holds expiry timestamps; its length is the live count
      value: necromancerUiState(context).shades?.length || 0,
      canStart: false,
      step: 1,
      displayMode: 'counter',
      pipStyle: 'necromancer-scourge-shades',
      shortLabel: 'Shade',
      statusLabel: 'Current',
      showValue: false
    }
  ],
  paletteSkillAvailability: scourgePaletteAvailability
});
