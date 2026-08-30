import { NECROMANCER_SKILL_IDS as ID } from '../../data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups,
  necromancerSoulShardResourceViews,
  necromancerUiState
} from '../../core/presentation.js';
import { getActiveTraits } from '../../data/traits-data.js';
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord
} from '../../../../../platform/engine/types.js';
import type { NecromancerSkill, NecromancerUiContext } from '../../types.js';

const SCOURGE_SKILLS = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD
]);

function scourgeSkillBarIds(context: NecromancerUiContext): readonly (string | number)[] {
  const activeTraitNames = new Set(getActiveTraits(context.build?.specializations || []).map((trait) => trait.name));
  return [
    ID.MANIFEST_SAND_SHADE,
    ID.NEFARIOUS_FAVOR,
    ID.SAND_CASCADE,
    ID.GARISH_PILLAR,
    // Herald of Sorrow replaces Desert Shroud (F4) with Sandstorm Shroud (F5) in the skill bar
    activeTraitNames.has('Herald of Sorrow') ? ID.SANDSTORM_SHROUD : ID.DESERT_SHROUD
  ];
}

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
  skillBarGroups: (context: NecromancerUiContext) =>
    necromancerTransformSkillBarGroups(context, {
      professionSkillIds: scourgeSkillBarIds(context)
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
