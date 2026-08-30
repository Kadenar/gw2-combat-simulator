/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_MISC_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHADOW_ASSAULT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 7.199999999999999,
        hits: 3,
        name: 'Shadow Assault',
        actorType: 'player',
        atMs: 120.24,
        intervalMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FLANKING_DIVE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Flanking Dive — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.625,
        hits: 1,
        name: 'Damage When Flanking',
        actorType: 'player'
      }
    ]
  },
  [ID.TOW_LINE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Tow Line',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 600
        }
      }
    ]
  },
  [ID.PIERCING_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Piercing Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.DELUGE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Deluge',
        actorType: 'player'
      }
    ]
  },
  [ID.ESCAPE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Missile Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Escape — Packet 2',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.CRIPPLING_SHOT_THIEF_HARPOON_GUN_SKILL]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Crippling Shot (thief harpoon gun skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.INK_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Ink Shot',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.SMOKE_TRAIL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.STAB_THIEF_SPEAR_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Stab (thief spear skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.JAB_THIEF_SKILL]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.15,
        hits: 1,
        name: 'Jab (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.POISON_TIP_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Poison Tip Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.NINE_TAILED_STRIKE]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 16,
        hits: 8,
        name: 'Nine-Tailed Strike — Packet 1',
        actorType: 'player',
        atMs: 125.333333333333,
        intervalMs: 125.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Final Strike Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 9,
        actorType: 'player'
      }
    ]
  },
  [ID.BREAK_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 2,
    effects: []
  },
  [ID.LESSER_CALTROPS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.ICE_WURM_VENOM_TRAP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    initiativeCost: 0,
    effects: []
  },
  [ID.LESSER_HASTE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 60,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.TRAIL_OF_KNIVES_DOPPELGANGER]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Trail of Knives (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.SOHOTHIN_BLOSSOM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 5,
    initiativeCost: 0,
    effects: []
  },
  [ID.THROW_GUNK_ID_45094]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 10.8,
        hits: 6,
        name: 'Throw Gunk',
        actorType: 'player',
        atMs: 83,
        intervalMs: 83,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIFT_PIN]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.HOOKED_SPEAR]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Hooked Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.BURST_OF_SHADOWS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Burst of Shadows',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.LIFT_PIN_HERO_CHALLENGE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.DEATHS_ADVANCE_ID_80278]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  }
});
