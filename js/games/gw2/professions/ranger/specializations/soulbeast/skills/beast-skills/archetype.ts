/**
 * Owns Soulbeast merged-pet skill definitions for the Archetype family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// ponytail: approximate channel pulses on the nominal cast timeline until merged-skill measurements are available.
const PRIMAL_CRY_PULSES_MS = [160, 520, 840];

export const SOULBEAST_ARCHETYPE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.PRIMAL_CRY]: {
    name: 'Primal Cry',
    description: 'Beast. Tap into your primal essence and unleash a debilitating roar.',
    icon: 'https://render.guildwars2.com/file/2B9826ADA82C1D2D3E9EE5B1F3E37CCD65DB4160/1770564.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 840,
    // Each surviving pulse deals damage before applying its own poison, bleeding, and vulnerability.
    interruptMode: 'per-packet',
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, condition: CONDITION.POISONED, stacks: 1, duration: 6 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }))
      },
      {
        type: 'condition',
        ticks: PRIMAL_CRY_PULSES_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 3,
          duration: 6
        }))
      }
    ])
  },
  [ID.WORLDLY_IMPACT]: {
    name: 'Worldly Impact',
    description: 'Beast. Jump up and slam the ground beneath you, severely damaging nearby foes.',
    icon: 'https://render.guildwars2.com/file/CFC8BF0C0DFEE030C12FDF0ABDD4E22F9C002924/1770572.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 25,
    beastmodeSkill: true,
    castTimeMs: 680,
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1.89 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PRELUDE_LASH]: {
    name: 'Prelude Lash',
    description: 'Beast. Pull foes toward you and bind them briefly.',
    icon: 'https://render.guildwars2.com/file/6BE209FCDE6DB2A802F54910DB73C0B70FF0E91B/1770563.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 25,
    beastmodeSkill: true,
    castTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.01,
        hits: 1
      },
      // The lash binds the target on impact in PvE (wiki: Prelude_Lash).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
    ]
  },
  [ID.SPIRITUAL_REPRIEVE]: {
    name: 'Spiritual Reprieve',
    description: 'Beast. Restore health to your allies and grant them a reprieve from conditions.',
    icon: 'https://render.guildwars2.com/file/0FA53836694C91EA3934E2929701EE56F32B7899/1770566.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 35,
    beastmodeSkill: true,
    castTimeMs: 667,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.UNFLINCHING_FORTITUDE]: {
    name: 'Unflinching Fortitude',
    description:
      'Beast. Shrug off all movement-impairing conditions and become unflinching in the face of normal attacks.',
    icon: 'https://render.guildwars2.com/file/0A0059CF0F036DBBE3EDAAFBC6136EA5F01E43CD/1770567.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 35,
    beastmodeSkill: true,
    castTimeMs: 167,
    effects: []
  }
});
