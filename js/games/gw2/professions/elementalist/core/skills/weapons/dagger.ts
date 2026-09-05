/**
 * Dagger weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 in all four attunements, including the Frost/Shocking aura
 * flipover pairs that swap between granting an aura and transmuting it.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const DRAKES_BREATH_TICK_OFFSETS_MS = [520, 760, 1000, 1240] as const;

// One tick per second of the fire trail Burning Speed leaves behind, shared by its strike and Burning timelines.
const BURNING_SPEED_FIELD_TICK_OFFSETS_MS = [160, 1160, 2160, 3160, 4160] as const;

/**
 * Skill-id keyed fragments the Core module contributes to the dagger catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
export const ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Three claws are thrown together, so one packet time carries three independent strikes.
  [ID.DRAGONS_CLAW]: {
    name: "Dragon's Claw",
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        coefficient: 1.35,
        hits: 3,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Channelled flame cone: four evenly spaced strike/Burning pairs. `per-packet` interruption keeps
  // only the ticks that already landed when the channel is cut short.
  [ID.DRAKES_BREATH]: {
    name: "Drake's Breath",
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1360,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 1.05
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 4
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Leap impact plus a lingering fire field: the trailing packets are tagged `field-tick` so Persisting
  // Flames can recognize and extend them along with the field itself.
  [ID.BURNING_SPEED]: {
    name: 'Burning Speed',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 800,
    cooldown: 12,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 800,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: BURNING_SPEED_FIELD_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.2,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: BURNING_SPEED_FIELD_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Single hit that also lays a five-second fire field for other skills to finish in.
  [ID.RING_OF_FIRE]: {
    name: 'Ring of Fire',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Burning',
            stacks: 2,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FIRE_GRAB]: {
    name: 'Fire Grab',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    interruptCommitMs: 480,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 3.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  // The blade strikes outbound and again on its return a second later, each pass applying Vulnerability.
  [ID.VAPOR_BLADE]: {
    name: 'Vapor Blade',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 360,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1360,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1360,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Four-tick channel, each tick declared as its own strike packet.
  [ID.CONE_OF_COLD]: {
    name: 'Cone of Cold',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1360,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1240,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Blast finisher that lands before its own ice field opens at cast end, so it can only finish an earlier field.
  [ID.FROZEN_BURST]: {
    name: 'Frozen Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 12,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Ice',
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.4,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Chilled',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Instant aura grant that flips the slot to Transmute Frost; `aura: 'Frost|10'` is the aura/duration
  // pair the cast-effects layer reads when applying it.
  [ID.FROST_AURA]: {
    name: 'Frost Aura',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_FROST,
    aura: 'Frost|10',
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Consumes the Frost Aura and flips the slot back to Frost Aura.
  [ID.TRANSMUTE_FROST]: {
    name: 'Transmute Frost',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.FROST_AURA,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Heal/cleanse only: no offensive packets, so the fragment exists to occupy cast time and recharge.
  [ID.CLEANSING_WAVE]: {
    name: 'Cleansing Wave',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Two-hit auto-attack landing inside a single cast.
  [ID.LIGHTNING_WHIP]: {
    name: 'Lightning Whip',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Delayed payload: the blast plus Weakness and Fury resolve roughly a second after the short cast ends.
  [ID.CONVERGENCE]: {
    name: 'Convergence',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1320,
            coefficient: 2.4,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1320,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 2.5,
        atMs: 1320,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Air-attunement counterpart of the Frost Aura pair: grants the aura and flips to Transmute Lightning.
  [ID.SHOCKING_AURA]: {
    name: 'Shocking Aura',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_LIGHTNING,
    aura: 'Shocking|10',
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Consumes the Shocking Aura for a crit-capable strike plus a crowd-control application, then flips back.
  [ID.TRANSMUTE_LIGHTNING]: {
    name: 'Transmute Lightning',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.SHOCKING_AURA,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 840,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.RIDE_THE_LIGHTNING]: {
    name: 'Ride the Lightning',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 120,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 80,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.UPDRAFT]: {
    name: 'Updraft',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        // Updraft's launch registers a 0-damage strike, which is what lets it
        // trigger on-hit effects such as Relic of Fireworks despite dealing no
        // damage.
        type: 'strike',
        ticks: [
          {
            atMs: 880,
            coefficient: 0
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 880,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.IMPALE]: {
    name: 'Impale',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 640,
            coefficient: 0.77
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 640,
            condition: 'Bleeding',
            stacks: 1,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Two impacts within one cast — the small initial hit and the larger delayed one — each carrying its
  // own Bleeding and Cripple application.
  [ID.RING_OF_EARTH]: {
    name: 'Ring of Earth',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Bleeding',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 1.9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 760,
            condition: 'Bleeding',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 760,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.EARTHEN_RUSH]: {
    name: 'Earthen Rush',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 2.3,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Leap',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.EARTHQUAKE]: {
    name: 'Earthquake',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 16,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 3,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 480,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // The zero-coefficient packet at cast start exists only to fire the blast finisher at channel start;
  // the damage and conditions land with the eruption near cast end.
  [ID.CHURNING_EARTH]: {
    name: 'Churning Earth',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 800,
            condition: 'Bleeding',
            stacks: 10,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 800,
            condition: 'Cripple',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
