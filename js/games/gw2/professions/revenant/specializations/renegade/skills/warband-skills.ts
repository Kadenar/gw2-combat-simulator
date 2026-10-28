/**
 * Owns Renegade warband, enhanced Band Together, stance, and triggered skill identities.
 * Stance-owned enhancement and triggered payloads are authored here; traits own their tuning.
 */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

/** Triggered attacks keep their own skill identities across player and allied grants. */
export const RAZORCLAW_PROC_ID = 'revenant.renegade.razorclaws-rage-proc';

export const SOULCLEAVE_PROC_ID = 'revenant.renegade.soulcleaves-summit-proc';

const BASE_RAZORCLAW_EFFECTS = Object.freeze([
  {
    type: 'strike',
    coefficient: 2,
    hits: 1,
    name: "Razorclaw's Rage",
    actorType: ACTOR.PLAYER
  },
  {
    type: 'condition',
    condition: CONDITION.BLEEDING,
    stacks: 4,
    duration: 8,
    actorType: ACTOR.PLAYER
  },
  {
    type: 'buff',
    kind: 'razorclaws-rage',
    duration: 5,
    stacks: 4,
    actorType: ACTOR.PLAYER,
    audience: { recipients: RECIPIENT.PARTY }
  }
] as const);

const BASE_BREAKRAZOR_EFFECTS = Object.freeze([
  {
    type: 'boon',
    audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
    boon: BOON.RESOLUTION,
    duration: 2.5,
    stacks: 1
  },
  {
    type: 'boon',
    audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
    boon: BOON.RESOLUTION,
    duration: 4,
    stacks: 1
  }
] as const);

// Quantize Icerazor impacts and their conditions together so each volley retains its 160 ms cadence.
export const RENEGADE_WARBAND_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ICERAZORS_IRE]: {
    cooldown: 10,
    energyCost: 20,
    legendId: 'LegendaryRenegade',
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/hooks.ts`.
    castTimeMs: 520,
    // Once summoned at 400 ms, Icerazor's remaining attacks survive interruption.
    interruptCommitMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        name: "Icerazor's Ire",
        actorType: ACTOR.PLAYER,
        ticks: [480, 640, 800].map((atMs) => ({ atMs, coefficient: 2 }))
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        ticks: [
          {
            atMs: 480,
            condition: CONDITION.VULNERABILITY,
            stacks: 10,
            duration: 8
          },
          { atMs: 480, condition: CONDITION.TORMENT, stacks: 3, duration: 6 },
          {
            atMs: 480,
            condition: CONDITION.VULNERABILITY,
            stacks: 5,
            duration: 8
          },
          {
            atMs: 800,
            condition: CONDITION.IMMOBILIZED,
            stacks: 1,
            duration: 2
          }
        ]
      }
    ]),
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.begin-band-together' } },
      { on: 'castCommit', do: { type: 'revenant.complete-band-together' } }
    ]
  },
  [ID.DARKRAZORS_DARING]: {
    cooldown: 12,
    energyCost: 25,
    legendId: 'LegendaryRenegade',
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/hooks.ts`.
    // The normal summon occupies 520 ms; Quickness does not shorten its animation.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 3 }],
        name: "Darkrazor's Daring",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      { type: 'boon', boon: BOON.STABILITY, duration: 1, stacks: 1, audience: { recipients: RECIPIENT.SELF } },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 1000, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'boon',
          boon: BOON.STABILITY,
          duration: 6,
          stacks: 3,
          audience: { recipients: RECIPIENT.PARTY }
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.DAZE
        }
      ])
    ],
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.begin-band-together' } },
      { on: 'castCommit', do: { type: 'revenant.complete-band-together' } }
    ]
  },
  [ID.DISMISS_LIEUTENANT_SOULCLEAVE]: {
    cooldown: 0,
    energyCost: 0,
    flipParentId: ID.SOULCLEAVES_SUMMIT,
    legendId: 'LegendaryRenegade',
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }]
  },
  [ID.RAZORCLAWS_RAGE]: {
    cooldown: 15,
    energyCost: 25,
    legendId: 'LegendaryRenegade',
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/hooks.ts`.
    castTimeMs: 360,
    effects: BASE_RAZORCLAW_EFFECTS,
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.begin-band-together' } },
      { on: 'castCommit', do: { type: 'revenant.arm-razorclaw' } },
      { on: 'castCommit', do: { type: 'revenant.complete-band-together' } }
    ]
  },
  [ID.BREAKRAZORS_BASTION]: {
    cooldown: 30,
    energyCost: 5,
    legendId: 'LegendaryRenegade',
    // Custom: Selects and consumes the enhanced Kalla skill profile from live state; see `renegade/hooks.ts`.
    castTimeMs: 520,
    effects: BASE_BREAKRAZOR_EFFECTS,
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.begin-band-together' } },
      { on: 'castCommit', do: { type: 'revenant.complete-band-together' } }
    ]
  },
  [ID.SOULCLEAVES_SUMMIT]: {
    cooldown: 3,
    energyCost: 5,
    upkeepCost: 5,
    pulseInterval: 1,
    manualReleaseCooldown: 3,
    flipSkillId: ID.DISMISS_LIEUTENANT_SOULCLEAVE,
    legendId: 'LegendaryRenegade',
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    castTimeMs: 360,
    effects: [],
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.soulcleave-allies' } }
    ]
  },
  [ID.ICERAZORS_IRE_ID_72359]: {
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    cooldown: 10,
    energyCost: 20,
    legendId: 'LegendaryRenegade',
    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: "Icerazor's Ire",
        actorType: ACTOR.PLAYER,
        ticks: [640, 800, 960].map((atMs) => ({ atMs, coefficient: 2 }))
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        ticks: [
          {
            atMs: 640,
            condition: CONDITION.VULNERABILITY,
            stacks: 10,
            duration: 8
          },
          { atMs: 640, condition: CONDITION.TORMENT, stacks: 3, duration: 6 },
          {
            atMs: 640,
            condition: CONDITION.VULNERABILITY,
            stacks: 5,
            duration: 8
          },
          { atMs: 640, condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 },
          { atMs: 800, condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 },
          {
            atMs: 960,
            condition: CONDITION.IMMOBILIZED,
            stacks: 1,
            duration: 2
          },
          { atMs: 960, condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 }
        ]
      }
    ])
  },
  [ID.RAZORCLAWS_RAGE_ID_72363]: {
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    cooldown: 15,
    energyCost: 25,
    legendId: 'LegendaryRenegade',
    castTimeMs: 0,
    effects: [
      BASE_RAZORCLAW_EFFECTS[0],
      BASE_RAZORCLAW_EFFECTS[1],
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      BASE_RAZORCLAW_EFFECTS[2]
    ]
  },
  [ID.DARKRAZORS_DARING_ID_72366]: {
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    cooldown: 12,
    energyCost: 25,
    legendId: 'LegendaryRenegade',
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 3 }],
        name: "Darkrazor's Daring",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      { type: 'boon', boon: BOON.STABILITY, duration: 1, stacks: 1, audience: { recipients: RECIPIENT.SELF } },
      { type: 'boon', boon: BOON.RESISTANCE, duration: 4, stacks: 1, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.PROTECTION, duration: 4, stacks: 1, audience: { recipients: RECIPIENT.PARTY } },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'boon',
          boon: BOON.STABILITY,
          duration: 6,
          stacks: 3,
          audience: { recipients: RECIPIENT.PARTY }
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.DAZE
        }
      ])
    ]
  },
  [ID.BREAKRAZORS_BASTION_ID_72389]: {
    simulatorExcluded: true,
    slotSelectable: false,
    variantBadge: 'Band Together',
    cooldown: 30,
    energyCost: 5,
    legendId: 'LegendaryRenegade',
    castTimeMs: 0,
    effects: BASE_BREAKRAZOR_EFFECTS
  },
  [ID.LEGENDARY_RENEGADE_STANCE]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    // Warband completion delivers this stance-owned window; entering the stance never grants it.
    effects: [],
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'revenant.complete-band-together',
          id: 'band-together',
          effects: [
            {
              name: 'band-together',
              type: 'buff',
              kind: 'band-together',
              duration: 4,
              stacks: 1,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.CALL_OF_THE_RENEGADE]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Call of the Renegade',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  }
});

function triggeredRenegadeAction(skill: Skill): Skill {
  return {
    type: 'Action',
    slot: 'Action',
    slotSelectable: false,
    specialization: 'Renegade',
    simulatorExcluded: true,
    cooldown: 0,
    effects: [],
    ...skill
  };
}

export const RENEGADE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  triggeredRenegadeAction({
    name: "Razorclaw's Rage — Empowered Attack",
    id: RAZORCLAW_PROC_ID,
    // Consecutive allied attacks consume the four buff charges without an internal cooldown.
    cooldown: 0,
    effects: [
      {
        name: CONDITION.BLEEDING,
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  }),
  triggeredRenegadeAction({
    name: "Soulcleave's Summit — Triggered Attack",
    id: SOULCLEAVE_PROC_ID,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: "Soulcleave's Summit — Additional Strike",
        actorType: ACTOR.EFFECT
      },
      {
        type: 'strike',
        coefficient: 0,
        damageKind: 'life-steal',
        flatStrikeBase: 325,
        flatStrikePowerCoeff: 0.1,
        hits: 1,
        name: "Soulcleave's Summit — Life Siphon",
        actorType: ACTOR.EFFECT,
        canCrit: false
      }
    ]
  })
]);
