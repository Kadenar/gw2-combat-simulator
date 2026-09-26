import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Both API IDs share the primary definition so future timing fixes cannot leave the alias behind.
const METAL_LEGION_GUITAR_SKILL: Partial<Skill> = {
  // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
  castTimeMs: 1920,
  cooldown: 0,
  initiativeCost: 0,
  effects: [
    {
      type: 'strike',
      coefficient: 3.2,
      hits: 4,
      atMs: 0,
      name: 'Metal Legion Guitar — Packet 1',
      actorType: 'player',
      timingAnchor: 'castEnd',
      timingScale: 'fixed'
    },
    {
      type: 'strike',
      ticks: [{ atMs: 0, coefficient: 2.5 }],
      name: 'Final Smash',
      actorType: 'player',
      timingAnchor: 'castEnd',
      timingScale: 'fixed'
    },
    {
      type: 'condition',
      ticks: [400, 920, 1400, 1920].map((atMs) => ({
        atMs,
        condition: 'Confusion',
        stacks: 1,
        duration: 8
      })),
      actorType: 'player',
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    },
    {
      type: 'control',
      actorType: 'player',
      controlKind: 'stun'
    }
  ],
  artifactKind: 'offensive'
};

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const ANTIQUARY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.METAL_LEGION_GUITAR]: METAL_LEGION_GUITAR_SKILL,
  [ID.METAL_LEGION_GUITAR_ID_76591]: METAL_LEGION_GUITAR_SKILL,
  [ID.FORGED_SURFER_DASH]: {
    movementSkill: true,
    // Custom: Replaces the cast with its task-driven movement/strike sequence through `antiquary/live.ts`.
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.4 }],
        name: 'Forged Surfer Dash — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [0, 120, 200, 320, 400].map((atMs) => ({ atMs, coefficient: 6 / 5 })),
        name: 'Additional Bomb Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [0, 120, 200, 320, 400].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 3.5
        })),
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 1, duration: 6 }],
        actorType: 'player'
      }
    ]),
    artifactKind: 'offensive'
  },
  [ID.HOLO_DANCER_DECOY]: {
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'taunt'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2
      },
      // The explosion shares its delayed impact with Might and Fury; the initial Might stays at cast completion.
      ...impactEffects({ atMs: 3000, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 2,
          hits: 1,
          name: 'Holo-Dancer Decoy',
          actorType: 'player'
        },
        {
          type: 'boon',
          boon: 'might',
          duration: 8,
          stacks: 4
        },
        {
          type: 'boon',
          boon: 'fury',
          duration: 8,
          stacks: 1
        }
      ])
    ],
    artifactKind: 'defensive'
  },
  [ID.EXALTED_HAMMER]: {
    movementSkill: true,
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Exalted Hammer',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.STONE_SUMMIT_CANNON]: {
    // Custom: Chooses success/backfire and materializes the selected outcome through `antiquary/live.ts`.
    usableWhileRecharging: true,
    castTimeMs: 520,
    cooldown: 15,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 320].map((atMs) => ({
          atMs,
          coefficient: 3 / 3
        })),
        name: 'Stone Summit Cannon — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 3,
          hits: 1,
          name: 'Stone Summit Cannon — Packet 2',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 3,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        }
      ])
    ]
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733]: {
    movementSkill: true,
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 680,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Zephyrite Sun Crystal',
        actorType: 'player'
      },
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 2 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 4,
        actorType: 'player' as const
      }))
    ]),
    artifactKind: 'defensive'
  },
  [ID.CHAK_SHIELD]: {
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        atMs: 0,
        name: 'Chak Shield',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.ANTIVENOM_DRAUGHT_BACKFIRED]: {
    castTimeMs: 520,
    cooldown: 10,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    // Custom: Chooses success/backfire and materializes the selected outcome through `antiquary/live.ts`.
    usableWhileRecharging: true,
    castTimeMs: 520,
    cooldown: 10,
    initiativeCost: 0,
    effects: []
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    movementSkill: true,
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 240,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.2 }],
        name: 'Zephyrite Sun Crystal',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          // Apply each Burning stack separately so same-impact relic checks observe every application.
          ...Array.from({ length: 2 }, () => ({ atMs: 400, condition: 'Burning' as const, stacks: 1, duration: 4 }))
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 5
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.UNSTABLE_SKRITT_BOMB]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Unstable Skritt Bomb',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback'
      }
    ],
    backfire: true
  },
  [ID.RESHUFFLE]: {
    // Custom: Randomizes/refills the Antiquary artifact hand through `antiquary/live.ts`.
    castTimeMs: 0,
    cooldown: 5,
    initiativeCost: 2,
    effects: []
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    castTimeMs: 360,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    castTimeMs: 440,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 760 + index * 400, coefficient: 2.8 / 8 })),
        name: 'Summon Kryptis Turret',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 8 }, (_, index) => ({
          atMs: 760 + index * 400,
          condition: 'Torment',
          stacks: 1,
          duration: 4
        })),
        actorType: 'player'
      }
    ]),
    artifactKind: 'offensive'
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309]: {
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.CANACH_COIN_TOSS]: {
    // Custom: Chooses success/backfire and materializes the selected outcome through `antiquary/live.ts`.
    usableWhileRecharging: true,
    castTimeMs: 0,
    cooldown: 15,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKRITT_SCUFFLE]: {
    // Custom: Replaces the cast with the delayed Skritt Scuffle sequence through `antiquary/live.ts`.
    castTimeMs: 560,
    cooldown: 50,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Skritt Scuffle',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch'
      }
    ]
  },
  [ID.MISTBURN_MORTAR]: {
    // Custom: Consumes the selected Antiquary artifact and updates artifact state through `antiquary/live.ts`.
    // Measured Quickness timings make artifact use reserve the same cast-lane time seen in EVTC.
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [520, 1520, 2520, 3520, 4520].map((atMs) => ({ atMs, coefficient: 2.5 / 5 })),
        name: 'Mistburn Mortar',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [520, 1520, 2520, 3520, 4520].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 1.5
        })),
        actorType: 'player'
      }
    ]),
    artifactKind: 'offensive'
  },
  [ID.SKRITT_SWIPE]: {
    stealTraitSkill: true,
    movementSkill: true,
    // Custom: Runs steal traits, pilfers artifacts, and applies swipe traits through `antiquary/live.ts`.
    castTimeMs: 200,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  }
});
