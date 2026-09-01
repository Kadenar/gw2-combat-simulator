/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Core toolbelt skill fragments and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MINE_FIELD]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion'
        }
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
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          skillName: 'Mine Field'
        }
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
    implemented: true,
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
    implemented: true,
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
  [ID.PAIN_TRANSFERENCE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Pain Transference',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Pain Inverter'
  },
  [ID.VENT_RADIATION]: {
    implemented: true,
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
  [ID.INVIGORATING_ROAR]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 50,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Battle Roar'
  },
  [ID.BOOBY_TRAP_CHARR_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Booby Trap (charr skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Shrapnel Mine'
  },
  [ID.HIDDEN_PISTOLS]: {
    implemented: true,
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
    implemented: true,
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
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ],
    toolbeltParentName: 'Seed Turret'
  },
  [ID.VINE_SHIELD]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Grasping Vines'
  },
  [ID.STATIC_SHOCK]: {
    implemented: true,
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
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ],
    toolbeltParentName: 'A.E.D.',
    mechanicSlot: 1
  },
  [ID.MED_PACK_DROP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 50,
    effects: [],
    toolbeltParentName: 'Supply Crate',
    mechanicSlot: 5
  }
});
