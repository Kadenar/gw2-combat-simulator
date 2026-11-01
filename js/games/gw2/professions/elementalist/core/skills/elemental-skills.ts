/**
 * Owns command skills for Glyph of Elementals summons.
 * Summon lifecycle and attack execution live in `mechanics/elementals/`.
 */
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Supplies command follow-ups for active Fire and Earth elementals. */
export const ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Flame Barrage',
    description: 'Command your summoned Fire Elemental to unleash a flame barrage.',
    icon: 'https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png',
    id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    type: 'Elite',

    slot: 'Elite',

    cooldown: 15,

    slotSelectable: false,

    castTimeMs: 0,
    effects: [],
    // A committed command preempts the live elemental action and schedules its next decision.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.command-elemental' } }]
  },
  {
    name: 'Stomp',
    description:
      'Command your summoned Earth Elemental to stomp, granting Protection to allies and crippling and immobilizing nearby foes.',
    icon: 'https://render.guildwars2.com/file/A39EBFA9E241DDBF6EEFBEC515192F32F5F2A620/867445.png',
    id: ID.STOMP_ELEMENTAL_COMMAND,
    type: 'Elite',

    slot: 'Elite',

    cooldown: 18,

    slotSelectable: false,

    castTimeMs: 0,
    effects: [],
    // A committed command preempts the live elemental action and schedules its next decision.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.command-elemental' } }]
  }
]);
