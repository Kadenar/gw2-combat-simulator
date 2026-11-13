/**
 * Owns Soulbeast merged-pet skill definitions for the Rock Gazelle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_ROCK_GAZELLE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.KICK]: {
    name: 'Kick',
    icon: 'https://render.guildwars2.com/file/2ADAEF05DE5D0F031ACE310DB425E01CE7180416/1770575.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 8,
    beastmodeSkill: true,
    // The supplied Gazelle log places Kick's impact before its recovery ends.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.94,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 6,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CHARGE]: {
    name: 'Charge',
    icon: 'https://render.guildwars2.com/file/9E1718ECB696EBE63CF7EE700306D2090DD8084B/1770573.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 12,
    beastmodeSkill: true,
    // Charge includes its startup and follow-up animation before releasing the cast lane.
    castTimeMs: 680,
    // The selected target takes the impact; travel damage belongs to enemies passed through.
    effects: [
      {
        type: 'strike',
        coefficient: 1.13,
        hits: 1,
        name: 'Charge - Impact Damage',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // The impact dazes the target and activates disable-triggered traits.
      { type: 'control', controlKind: CONTROL.DAZE, atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }
    ]
  }
};
