/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIGHTY_ROAR]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 15,
        stacks: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FORAGE_ROCK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.RENDING_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.INTIMIDATING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.SHAKE_IT_OFF]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PURGE_CONDITIONS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISONOUS_CLOUD]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          coefficient: 0.2,
          metadata: {
            weaponStrength: 2880,
            independentSummonStrike: true,
            summonUsesProfessionModifiers: true,
            summonInheritsAttributes: true,
            summonInheritsCriticalAttributes: true
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          condition: 'Poisoned',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger',
        actorType: 'player'
      }
    ],
    quicknessCastTimeMs: 880,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    petSkill: true
  },
  [ID.REGENERATE]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FIRE_BREATH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 5,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.BOIL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.CHILLING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ICY_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 2,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ICY_BITE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 167,
    petSkill: true
  },
  [ID.BLINDING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.STALK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.INSECT_SWARM]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.POISON_CLOUD]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PROTECTING_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.ICY_SCREECH]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DAZING_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DAZING_SCREECH_ID_12709]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FURIOUS_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FROST_BREATH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 5,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.FROST_NOVA]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.LIGHTNING_BREATH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6500000000000001,
        hits: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ELECTROCUTE_ID_12699]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISON_CLOUD_ID_12687]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISONOUS_MAUL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 12,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.FEEDING_FRENZY]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.REGENERATE_ID_12717]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.ENFEEBLING_MAUL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ENFEEBLING_ROAR]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 833,
    petSkill: true
  },
  [ID.ICY_ROAR]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 833,
    petSkill: true
  },
  [ID.ICY_MAUL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.RENDING_MAUL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.34,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  },
  [ID.POISON_CLOUD_ID_12702]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISON_BARBS]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true
  },
  [ID.LASHTAIL_VENOM]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.RENDING_BARBS]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.7999999999999998,
        hits: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 2667,
    petSkill: true
  },
  [ID.HOWL_OF_THE_PACK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.TERRIFYING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.CHILLING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.BRASH_SLASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DEADLY_VENOM]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PARALYZING_VENOM]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.WEAKENING_VENOM]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FORAGE_SCALE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_FEATHERS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_SWORD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.STUNNING_RUSH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true
  },
  [ID.CHILLING_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 4,
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true
  },
  [ID.IMMOBILIZING_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true
  },
  [ID.LACERATING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 15,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 15,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SONIC_SHRIEK]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 10,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.SONIC_BARRIER]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SMOKE_CLOUD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.FURIOUS_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.FELINE_SLASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 480,
    petSkill: true
  },
  [ID.FELINE_BITE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 800,
    petSkill: true
  },
  [ID.FELINE_MAUL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 10,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 840,
    petSkill: true
  },
  [ID.LIGHTNING_ASSAULT]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.CONSUMING_FLAME]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true
  },
  [ID.SPIKE_BARRAGE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1333,
    petSkill: true
  },
  [ID.SAVANNAH_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.BLINDING_ROAR]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.0499999999999998,
        hits: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.JACARANDAS_EMBRACE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [0, 1500, 3000, 4500, 6000].map((atMs) => ({
          atMs,
          coefficient: 0.2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [0, 1500, 3000, 4500, 6000].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 8
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [1, 2, 2, 2, 2].map((duration, index) => ({
          atMs: index * 1500,
          condition: 'Immobilized',
          stacks: 1,
          duration
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 880,
    petSkill: true
  },
  [ID.JACARANDA_ROOT_SLAP]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 800,
    petSkill: true
  },
  [ID.JACARANDA_CALL_LIGHTNING]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          coefficient: 0.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.HEAD_TOSS]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.11,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.FANG_GRAPPLE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1040, coefficient: 0.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        atMs: 1040,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        atMs: 1040,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon',
        metadata: { controlKind: 'pull' }
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.GUARDIANS_ROAR]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  },
  [ID.GALE_BREATH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.HUNKER_DOWN]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DIMENSION_BREACH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.LEY_ENERGY_PULSE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.PANOPTICON]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.RALLYING_ROAR]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.HONEY_TOSS]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.PIERCING_SHRIEK]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.INNOCENT_DISPLAY]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  },
  [ID.TWIN_DARTS]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 840, coefficient: 0.15 },
          { atMs: 920, coefficient: 0.15 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        ticks: [840, 920].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 2,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 880,
    petSkill: true
  },
  [ID.PET_TAIL_LASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1280, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        atMs: 1280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon',
        metadata: { controlKind: 'knockback' }
      }
    ],
    quicknessCastTimeMs: 1280,
    petSkill: true
  },
  [ID.CONSUMING_BITE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 480,
    petSkill: true
  },
  [ID.CRIPPLING_ANGUISH_PET]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 4,
        duration: 8,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 10,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 600,
    petSkill: true
  },
  [ID.NARCOTIC_SPORES_PET]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          coefficient: 0.1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          condition: 'Confusion',
          stacks: 1,
          duration: 8
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 720,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Ethereal',
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    petSkill: true
  },
  [ID.SPIT]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.57,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 833,
    petSkill: true
  }
});
