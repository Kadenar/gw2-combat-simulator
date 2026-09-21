/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// EVTC-measured Quickness timings keep spear casts aligned with their observed cast-lane occupancy.
// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ENTANGLING_ASP]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 2,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Entangling Asp',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
  },
  [ID.SHATTERING_ASSAULT]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 640,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.8 }],
        name: 'Shattering Assault',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISTRACTING_THROW]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          hits: 1,
          name: 'Distracting Throw',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 3,
          duration: 6,
          actorType: 'player'
        }
      ]),
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Unsuspecting Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ])
  },
  [ID.SHADOW_VEIL]: {
    castTimeMs: 1360,
    cooldown: 0,
    initiativeCost: 3,
    effects: []
  },
  [ID.ASHEN_ASSAULT]: {
    preservesStealth: true,
    spearStealthAttack: true,
    // Custom: Selects the stealth spear chain, then consumes stealth on completion; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-stealth-attack',
    castTimeMs: 1200,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1.5 / 5
        })),
        name: 'Ashen Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.3,
          hits: 1,
          name: 'Ashen Assault — Final Strike',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 5,
          duration: 8,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Poisoned',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        }
      ])
    ],
    requiredMainHand: 'Spear',
    stealthAttack: true
  },
  [ID.MANTIS_STING]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 400,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mantis Sting',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ])
  },
  [ID.VAMPIRIC_SLASH]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Vampiric Slash — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.2,
          hits: 1,
          name: 'Vampiric Slash — Life Siphon',
          // The vulnerability modifier targets this packet identity without depending on its display label.
          metadata: { packetKind: 'thief.vampiric-slash-life-siphon' },
          actorType: 'player',
          canCrit: false
        },
        {
          type: 'condition',
          condition: 'Weakness',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        }
      ])
    ]
  },
  [ID.FALLING_SPIDER]: {
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 1,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Falling Spider',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ])
  },
  [ID.BARBED_SPEAR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // Custom: Selects the spear follow-up chain and reacts to committed packets; see `core/mechanics/spear-chain.ts`.
    handlerId: 'thief.spear-chain',
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Barbed Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2.25,
        actorType: 'player'
      }
    ])
  }
});
