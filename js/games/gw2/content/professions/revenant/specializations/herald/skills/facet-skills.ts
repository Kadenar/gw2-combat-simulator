/**
 * Owns Herald facet, consume, stance, and legend-call skill fragments.
 * Facet runtime state remains under sibling `mechanics/` modules.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Facet of Nature has one legend-dependent consume, but every variant occupies
// the same profession-mechanic tile as the activating facet.
const FACET_OF_NATURE_PALETTE_TILE = 'revenant-herald-facet-of-nature';
const TRUE_NATURE_SHARED_COOLDOWN = 20;

export const HERALD_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FACET_OF_STRENGTH]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 2,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: 'might', duration: 12, stacks: 1 },
    upkeepConsumeId: ID.BURST_OF_STRENGTH
  },
  [ID.FACET_OF_ELEMENTS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 1,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: 'swiftness', duration: 3, stacks: 1 },
    upkeepConsumeId: ID.ELEMENTAL_BLAST
  },
  [ID.GAZE_OF_DARKNESS]: {
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    castTimeMs: 0,
    cooldown: 15,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Revealed',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 5
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.ELEMENTAL_BLAST]: {
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: 12,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        name: 'Elemental Blast',
        actorType: 'player',
        ticks: [
          {
            atMs: 280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 1'
          },
          {
            atMs: 1280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 2'
          },
          {
            atMs: 2280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 3'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          {
            atMs: 280,
            condition: 'Weakness',
            stacks: 1,
            duration: 5
          },
          {
            atMs: 1280,
            condition: 'Chilled',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2280,
            condition: 'Burning',
            stacks: 2,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_LIGHT]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 250,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 1,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: 'regeneration', duration: 4, stacks: 1 },
    upkeepConsumeId: ID.INFUSE_LIGHT
  },
  [ID.INFUSE_LIGHT]: {
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_CHAOS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 4,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: 'protection', duration: 3, stacks: 1 },
    upkeepConsumeId: ID.CHAOTIC_RELEASE
  },
  [ID.CHAOTIC_RELEASE]: {
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 600,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 4 }],
        name: 'Chaotic Release',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'knockback',
        duration: 360
      },
      {
        type: 'buff',
        kind: 'superspeed',
        duration: 5,
        stacks: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.BURST_OF_STRENGTH]: {
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 840,
    cooldown: 12,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.2 / 2 })),
        name: 'Burst of Strength',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'burst-of-strength',
        duration: 10,
        stacks: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_DARKNESS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 2,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: 'fury', duration: 3, stacks: 1 },
    upkeepConsumeId: ID.GAZE_OF_DARKNESS
  },
  [ID.FACET_OF_NATURE]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 1,
    energyCost: 0,
    upkeepCost: 2,
    effects: [],
    // Herald's F2 remains available outside Glint so the active legend can select its True Nature variant.
    facet: true,
    pulseInterval: 3,
    upkeepConsumeByLegendId: {
      LegendaryAssassin: ID.TRUE_NATURE,
      LegendaryDwarf: ID.TRUE_NATURE_ID_51675,
      LegendaryDragon: ID.TRUE_NATURE_ID_51696,
      LegendaryCentaur: ID.TRUE_NATURE_ID_51713,
      LegendaryDemon: ID.TRUE_NATURE_ID_51714
    }
  },
  [ID.TRUE_NATURE]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'True Nature (assassin)',
        actorType: 'player'
      }
    ],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51675]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 4,
        stacks: 2
      }
    ],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51696]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [
      {
        type: 'custom',
        eventType: 'proc',
        event: {
          procType: 'boon-extension',
          name: 'True Nature (dragon) — Boon Extension',
          duration: 2,
          audience: { recipients: 'party' as const, maximumRecipients: 5 }
        }
      }
    ],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51713]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51714]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    // Custom: Stops the parent facet upkeep after the consume skill resolves; see `herald/mechanics/facet-upkeep.ts`.
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      }
    ],
    consume: true
  },
  [ID.LEGENDARY_DRAGON_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_DRAGON]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dragon',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 3,
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
  }
});
