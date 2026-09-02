/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_MISC_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DOME_OF_THE_MISTS]: {
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.IGNITING_BRAND]: {
    castTimeMs: 500,
    cooldown: 12,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Igniting Brand',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.SPEAR_OF_ANGUISH]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spear of Anguish',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.FRIGID_DISCHARGE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Frigid Discharge',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.DEVOUR_BRAND]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Devour Brand',
        actorType: 'player'
      }
    ]
  },
  [ID.VENOMOUS_SPHERE]: {
    castTimeMs: 750,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Venomous Sphere',
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
  [ID.RAPID_ASSAULT]: {
    castTimeMs: 1250,
    cooldown: 5,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 104.832 + index * 104.832, coefficient: 24 / 8 })),
        name: 'Rapid Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.RIFT_CONTAINMENT]: {
    castTimeMs: 500,
    cooldown: 20,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 72 + index * 72,
          coefficient: 6.6000000000000005 / 5
        })),
        name: 'Rift Containment',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.HEALING_ORB]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.RITE_OF_THE_GREAT_DWARF_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 45,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.VENGEFUL_SNOWBALLS]: {
    castTimeMs: 0,
    cooldown: 45,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_SAP_DOPPELGANGER]: {
    castTimeMs: 250,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Essence Sap (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.CALL_OF_THE_DWARF]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dwarf',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.CALL_OF_THE_CENTAUR]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_ASSASSIN]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Assassin',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'Quickness',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Quickness',
        duration: 1,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_THE_DEMON]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Call of the Demon',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.UNCHAINED_DESOLATION]: {
    castTimeMs: 2000,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_PRISONER_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.RIFT_OF_PAIN]: {
    castTimeMs: 750,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Rift of Pain',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 1.5,
        stacks: 1
      }
    ]
  },
  [ID.MISTSFIRE]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Mistsfire',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1.75,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 0.5,
        actorType: 'player'
      }
    ]
  },
  [ID.RECKONING_BLAST]: {
    castTimeMs: 1000,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 340 + index * 340, coefficient: 0.8 / 2 })),
        name: 'Reckoning Blast',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 1.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 400
      }
    ]
  },
  [ID.PORTAL_FIRE]: {
    castTimeMs: 1250,
    cooldown: 6,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 104.832 + index * 104.832, coefficient: 21.12 / 8 })),
        name: 'Portal Fire',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 0.5,
        actorType: 'player'
      }
    ]
  },
  [ID.TORRENTIAL_MISTS]: {
    castTimeMs: 2000,
    cooldown: 20,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 22 }, (_, index) => ({
          atMs: 61.88 + index * 61.88,
          coefficient: 106.47999999999999 / 22
        })),
        name: 'Torrential Mists',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 0.5,
        actorType: 'player'
      }
    ]
  },
  [ID.INVOKE_TORMENT]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Invoke Torment',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.PHANTOMS_ONSLAUGHT_ID_62713]: {
    quicknessCastTimeMs: 438,
    dashTimeMs: 38,
    hitDelayMs: 400,
    cooldown: 8,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: 420,
    energyCost: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: "Phantom's Onslaught",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.OTHERWORLDLY_ATTRACTION_ALLY]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 10,
    effects: []
  },
  [ID.OTHERWORLDLY_ATTRACTION_ENEMY]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.BLITZ_MINES]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Blitz Mines',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.REPLENISHING_DESPAIR_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.064,
        hits: 1,
        name: 'Replenishing Despair (trait skill)',
        actorType: 'player'
      }
    ]
  }
});
