/**
 * Herald skill mechanics owned by the Herald Revenant module.
 */
import { REVENANT_SKILL_IDS as ID } from '../../../data/ids.js';
import type { BalanceProfile, SkillFragment } from '../../../../../../platform/engine/types.js';

export const HERALD_SPIRIT_BOON_PROFILE_ID = 'revenant.spirit-boon.dragon';
export const HERALD_ELEVATED_COMPASSION_PROFILE_ID = 'revenant.elevated-compassion';
export const HERALD_SHARED_EMPOWERMENT_PROFILE_ID = 'revenant.shared-empowerment';

// Facet of Nature has one legend-dependent consume, but every variant occupies
// the same profession-mechanic tile as the activating facet.
const FACET_OF_NATURE_PALETTE_TILE = 'revenant-herald-facet-of-nature';
const TRUE_NATURE_SHARED_COOLDOWN = 20;

export const HERALD_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FACET_OF_STRENGTH]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
        metadata: {
          duration: 5
        }
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.ELEMENTAL_BLAST]: {
    implemented: true,
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
            metadata: { name: 'Elemental Blast — Pulse 1' }
          },
          {
            atMs: 1280,
            coefficient: 1.5,
            metadata: { name: 'Elemental Blast — Pulse 2' }
          },
          {
            atMs: 2280,
            coefficient: 1.5,
            metadata: { name: 'Elemental Blast — Pulse 3' }
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
    implemented: true,
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
    implemented: true,
    handlerId: 'revenant.facet-consume',
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_CHAOS]: {
    implemented: true,
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
    implemented: true,
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 600,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1,
        name: 'Chaotic Release',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'knockback',
          duration: 360
        }
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
    implemented: true,
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 840,
    cooldown: 12,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3.2,
        hits: 2,
        name: 'Burst of Strength',
        actorType: 'player',
        atMs: 360,
        intervalMs: 320,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
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
    implemented: true,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
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
    implemented: true,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
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
          recipients: 'party',
          maximumRecipients: 5
        }
      }
    ],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51713]: {
    implemented: true,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    handlerId: 'revenant.facet-consume',
    quicknessCastTimeMs: 480,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    effects: [],
    consume: true
  },
  [ID.TRUE_NATURE_ID_51714]: {
    implemented: true,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
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
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_DRAGON]: {
    implemented: true,
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

export const HERALD_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
    name: 'Shared Empowerment',
    profileKind: 'trait',
    description: 'Applying a boon to an ally grants nearby allies one stack of might.',
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        actorType: 'effect',
        recipients: 'party',
        maximumRecipients: 5
      }
    ]
  },
  {
    id: HERALD_ELEVATED_COMPASSION_PROFILE_ID,
    name: 'Elevated Compassion',
    profileKind: 'trait',
    description: 'Grants quickness while aggregate upkeep is at least six.',
    cooldown: 1,
    threshold: 6,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 1.25,
        stacks: 1,
        actorType: 'player',
        recipients: 'party'
      }
    ]
  },
  {
    id: HERALD_SPIRIT_BOON_PROFILE_ID,
    name: 'Spirit Boon (Dragon)',
    profileKind: 'trait',
    description: 'Invoking Legendary Dragon grants protection to nearby allies.',
    icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
]);
