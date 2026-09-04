/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines Core toolbelt skill fragments and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MINE_FIELD]: {
    // Custom: Defers precast mines to combat start and applies detonation traits; see `core/execution/index.ts`.
    handlerId: 'engineer.mine-field',
    quicknessCastTimeMs: 920,
    cooldown: 17,
    effects: [
      {
        type: 'strike',
        coefficient: 3.85,
        hits: 5,
        atMs: 0,
        name: 'Damage per Mine',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.DETONATE_MINE_FIELD]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: 'player',
        damageKind: 'explosion',
        skillName: 'Mine Field'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.REGENERATING_MIST]: {
    castTimeMs: 0,
    cooldown: 18,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 2
      }
    ],
    toolbeltParentName: 'Healing Turret',
    mechanicSlot: 1
  },
  [ID.CONFUSING_SPEECH]: {
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Technobabble'
  },
  [ID.VENT_RADIATION]: {
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 9,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Radiation Field'
  },
  [ID.HIDDEN_PISTOLS]: {
    castTimeMs: 1750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Hidden Pistols',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Hidden Pistol'
  },
  [ID.THROW_VINE]: {
    castTimeMs: 500,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Throw Vine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockdown',
        duration: 2
      }
    ],
    toolbeltParentName: 'Seed Turret'
  },
  [ID.STATIC_SHOCK]: {
    quicknessCastTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Static Shock',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'control',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        controlKind: 'daze',
        duration: 2
      }
    ],
    toolbeltParentName: 'A.E.D.',
    mechanicSlot: 1
  },
  [ID.MED_PACK_DROP]: {
    castTimeMs: 500,
    cooldown: 50,
    effects: [],
    toolbeltParentName: 'Supply Crate',
    mechanicSlot: 5
  }
});
