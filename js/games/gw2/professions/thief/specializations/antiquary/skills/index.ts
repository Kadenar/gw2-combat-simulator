import { ACTOR, CONTROL, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

// Artifact acceptance spends the old pool; traits surround the skill's intrinsic identity at commitment.
const ARTIFACT_START: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'thief.artifact-spend' as const } },
  { on: 'castCommit', do: { type: 'thief.artifact-activated' as const } }
];
const ARTIFACT_END: NonNullable<Skill['sideEffects']> = [
  { on: 'castCommit', do: { type: 'thief.artifact-completed' as const } }
];

// Both API IDs share the primary definition so future timing fixes cannot leave the alias behind.
const METAL_LEGION_GUITAR_SKILL: Partial<Skill> = {
  // The artifact owns the number of stealth attacks granted by its identity window.
  maximumStacks: 3,
  cooldown: 0,
  initiativeCost: 0,
  artifactKind: 'offensive',

  castTimeMs: 1920,
  effects: [
    {
      type: 'strike' as const,
      coefficient: 3.2,
      hits: 4,
      atMs: 0,
      name: 'Metal Legion Guitar — Packet 1',
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castEnd' as const,
      timingScale: 'fixed' as const
    },
    {
      type: 'strike' as const,
      ticks: [{ atMs: 0, coefficient: 2.5 }],
      name: 'Final Smash',
      // Meticulous Custodian keys its separate final-hit factor on this packet identity, not the display label.
      metadata: { packetKind: 'thief.metal-legion-guitar-final-smash' },
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castEnd' as const,
      timingScale: 'fixed' as const
    },
    {
      type: 'condition' as const,
      ticks: [400, 920, 1400, 1920].map((atMs) => ({
        atMs,
        condition: CONDITION.CONFUSION,
        stacks: 1,
        duration: 8
      })),
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castStart' as const,
      timingScale: 'fixed' as const
    },
    {
      type: 'control' as const,
      actorType: ACTOR.PLAYER,
      controlKind: CONTROL.STUN
    }
  ],
  sideEffects: [
    ...ARTIFACT_START,
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.METAL_LEGION_GUITAR,
      do: { type: 'thief.guitar' as const }
    },
    ...ARTIFACT_END
  ]
};

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const ANTIQUARY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.METAL_LEGION_GUITAR]: METAL_LEGION_GUITAR_SKILL,
  [ID.METAL_LEGION_GUITAR_ID_76591]: METAL_LEGION_GUITAR_SKILL,
  [ID.FORGED_SURFER_DASH]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initialDelay: 1,
    pulseInterval: 3,
    duration: 10,
    enhancedDuration: 13,
    maximumDuration: 13,

    movementSkill: true,
    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'offensive',

    castTimeMs: 200,
    // The buff and bomb sequence commit before the dash ends, while its remaining animation still locks casting.
    interruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [],
    sideEffects: [
      ...ARTIFACT_START,
      { on: 'castCommit', do: { type: 'thief.surfer-window' as const } },
      ...ARTIFACT_END,
      {
        on: 'castCommit',
        do: {
          type: 'thief.forged-surfer' as const,
          id: 'surfer',
          effects: [
            { type: 'strike' as const, name: 'Dash', coefficient: 2.4, hits: 1 },
            { type: 'condition' as const, name: 'Dash', condition: CONDITION.BURNING, stacks: 1, duration: 6 },
            { type: 'strike' as const, name: 'Bomb', coefficient: 1.2, hits: 1 },
            { type: 'condition' as const, name: 'Bomb', condition: CONDITION.BURNING, stacks: 1, duration: 3.5 },
            ...[
              { type: 'strike' as const, name: 'Dash', coefficient: 2.8, hits: 1 },
              // Meticulous replaces the dash burn with one eight-second stack before expertise.
              { type: 'condition' as const, name: 'Dash', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
              { type: 'strike' as const, name: 'Bomb', coefficient: 1.4, hits: 1 },
              { type: 'condition' as const, name: 'Bomb', condition: CONDITION.BURNING, stacks: 1, duration: 4.5 }
            ].map((effect) => ({ ...effect, name: 'Meticulous ' + effect.name }))
          ]
        }
      }
    ]
  },
  [ID.HOLO_DANCER_DECOY]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    rechargeMultiplier: 0.2,

    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'defensive',

    castTimeMs: 600,
    effects: [
      {
        type: 'control' as const,
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.TAUNT
      },
      {
        type: 'boon' as const,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 2
      },
      // The explosion shares its delayed impact with Might and Fury; the initial Might stays at cast completion.
      ...impactEffects({ atMs: 3000, timingAnchor: 'castEnd' as const, timingScale: 'fixed' as const }, [
        {
          type: 'strike' as const,
          coefficient: 2,
          hits: 1,
          name: 'Holo-Dancer Decoy',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'boon' as const,
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 4
        },
        {
          type: 'boon' as const,
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.FURY,
          duration: 8,
          stacks: 1
        }
      ])
    ],
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.holo' as const } }, ...ARTIFACT_END]
  },
  [ID.EXALTED_HAMMER]: {
    movementSkill: true,
    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'defensive',

    castTimeMs: 0,
    effects: [
      {
        type: 'strike' as const,
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Exalted Hammer',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd' as const,
        timingScale: 'fixed' as const
      },
      {
        type: 'boon' as const,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 5,
        stacks: 1
      }
    ],
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END]
  },
  [ID.STONE_SUMMIT_CANNON]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    backfireDelay: 2,

    // Acceptance fixes the outcome; even a cancelled use fires from its effective end with fixed profile offsets.
    usableWhileRecharging: true,
    cooldown: 15,
    initiativeCost: 0,
    castTimeMs: 520,
    effects: [
      ...[
        {
          type: 'strike' as const,
          name: 'Stone Summit Cannon - Success',
          ticks: [
            { atMs: 440, coefficient: 1 },
            { atMs: 720, coefficient: 1 },
            { atMs: 1000, coefficient: 1 }
          ]
        },
        // Burning owns its application timing so deleting the strike does not delete this packet.
        {
          type: 'condition' as const,
          name: CONDITION.BURNING,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3,
          applications: 3,
          atMs: 440,
          intervalMs: 280,
          timingAnchor: 'castEnd' as const,
          timingScale: 'fixed' as const
        }
      ].map((effect) => ({ ...effect, packetLabel: 'success' })),
      ...[
        { type: 'strike' as const, name: 'Stone Summit Cannon - Backfire', coefficient: 3, hits: 1 },
        {
          type: 'condition' as const,
          name: CONDITION.BURNING,
          condition: CONDITION.BURNING,
          // Backfire applies the total at one impact; resolution expands its stacks.
          stacks: 3,
          duration: 4
        }
      ].map((effect) => ({ ...effect, name: 'Backfire ' + effect.name, packetLabel: 'backfire' }))
    ],
    effectVariants: [true, false].map<NonNullable<Skill['effectVariants']>[number]>((backfire) => ({
      when: (runtime, cast) => Boolean(antiquaryState.from(runtime).backfireState[cast.skill.id]) === backfire,
      transform: (_runtime, cast, effects) => {
        const delay = backfire ? skillNumber(cast.skill, 'backfireDelay') : 0;
        const offsetMs = (cast.effectiveEnd - cast.start + delay) * 1000;
        return effects
          .filter((effect) => effect.packetLabel === (backfire ? 'backfire' : 'success'))
          .map((effect) => ({
            ...effect,
            name: backfire
              ? 'Stone Summit Cannon — Backfire'
              : effect.type === 'condition'
                ? 'Stone Summit Cannon — Burning'
                : 'Stone Summit Cannon',
            timingAnchor: 'castStart' as const,
            timingScale: 'fixed' as const,
            interruptCommitMs: 0,
            persistsAfterInterrupt: true,
            atMs: offsetMs + (effect.atMs ?? 0),
            ...(Array.isArray(effect.ticks)
              ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: offsetMs + tick.atMs })) }
              : {})
          }));
      }
    })),
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' as const } }]
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733]: {
    movementSkill: true,
    cooldown: 1,
    initiativeCost: 0,
    artifactKind: 'defensive',

    castTimeMs: 680,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd' as const, timingScale: 'fixed' as const }, [
      {
        type: 'strike' as const,
        coefficient: 1.2,
        hits: 1,
        name: 'Zephyrite Sun Crystal',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition' as const,
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END]
  },
  [ID.CHAK_SHIELD]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    refundCharges: 3,
    maximumStacks: 4,

    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'defensive',

    castTimeMs: 0,
    effects: [
      {
        type: 'strike' as const,
        coefficient: 1.5,
        hits: 5,
        atMs: 0,
        name: 'Chak Shield',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd' as const,
        timingScale: 'fixed' as const
      }
    ],
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.chak' as const } }, ...ARTIFACT_END]
  },
  [ID.ANTIVENOM_DRAUGHT_BACKFIRED]: {
    // Backfire states are internal outcomes, not independently equipable loadout choices.
    slotSelectable: false,
    cooldown: 10,
    initiativeCost: 0,
    backfire: true,
    castTimeMs: 520,
    effects: []
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    usableWhileRecharging: true,
    cooldown: 10,
    initiativeCost: 0,
    castTimeMs: 520,
    effects: [],
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' as const } }]
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.packetLabel !== 'meticulous')
      }
    ],

    movementSkill: true,
    cooldown: 1,
    initiativeCost: 0,
    artifactKind: 'defensive',

    castTimeMs: 240,
    // The arrival commits before the dash animation ends; its launched effects keep the remaining cast lockout.
    interruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      ...impactEffects({ persistsAfterInterrupt: true }, [
        {
          type: 'strike' as const,
          ticks: [{ atMs: 0, coefficient: 1.2 }],
          name: 'Zephyrite Sun Crystal',
          actorType: ACTOR.PLAYER,
          timingAnchor: 'castEnd' as const,
          timingScale: 'fixed' as const
        },
        {
          type: 'condition' as const,
          name: CONDITION.BURNING,
          ticks: [{ atMs: 400, condition: CONDITION.BURNING, stacks: 2, duration: 4 }],
          actorType: ACTOR.PLAYER,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        },
        {
          type: 'condition' as const,
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ]),

      {
        type: 'condition' as const,
        name: 'Meticulous Burning',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5,
        packetLabel: 'meticulous'
      }
    ],
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END]
  },
  [ID.UNSTABLE_SKRITT_BOMB]: {
    slotSelectable: false,
    artifactKind: 'unstable',
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike' as const,
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Unstable Skritt Bomb',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd' as const,
        timingScale: 'fixed' as const
      },
      {
        type: 'control' as const,
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKBACK
      }
    ],
    // Scuffle grants this manually activated backfire in place of an artifact; using it spends the held grant.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.artifact-spend' as const } }]
  },
  [ID.RESHUFFLE]: {
    cooldown: 5,
    initiativeCost: 2,

    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.reshuffle' as const } }]
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    // Only the usable cannon is selectable, even though its disabled backfire state shares the same name.
    slotSelectable: false,
    cooldown: 15,
    initiativeCost: 0,
    backfire: true,
    castTimeMs: 360,
    effects: []
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 8,

    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'offensive',

    castTimeMs: 440,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd' as const, timingScale: 'fixed' as const }, [
      {
        type: 'strike' as const,
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 760 + index * 400, coefficient: 2.8 / 8 })),
        name: 'Summon Kryptis Turret',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition' as const,
        ticks: Array.from({ length: 8 }, (_, index) => ({
          atMs: 760 + index * 400,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 4
        })),
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.kryptis' as const } }, ...ARTIFACT_END]
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309]: {
    movementSkill: true,
    cooldown: 1,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.CANACH_COIN_TOSS]: {
    usableWhileRecharging: true,
    cooldown: 15,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [
      { on: 'castStart', do: { type: 'thief.double-edge' as const } },
      { on: 'castStart', do: { type: 'thief.roll-coins' as const } },
      { on: 'castCommit', do: { type: 'thief.pay-coins' as const } }
    ]
  },
  [ID.SKRITT_SCUFFLE]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 15,
    pulseInterval: 3,

    cooldown: 50,
    initiativeCost: 0,

    castTimeMs: 560,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-scuffle' as const } }]
  },
  [ID.MISTBURN_MORTAR]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    maximumStacks: 5,

    cooldown: 0,
    initiativeCost: 0,
    artifactKind: 'offensive',

    // Measured Quickness timings make artifact use reserve the same cast-lane time seen in EVTC.
    castTimeMs: 600,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart' as const, timingScale: 'fixed' as const }, [
      {
        type: 'strike' as const,
        ticks: [520, 1520, 2520, 3520, 4520].map((atMs) => ({ atMs, coefficient: 2.5 / 5 })),
        name: 'Mistburn Mortar',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition' as const,
        ticks: [520, 1520, 2520, 3520, 4520].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1.5
        })),
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: [
      ...ARTIFACT_START,
      {
        on: 'castCommit',
        do: {
          type: 'thief.mortar' as const,
          id: 'charged',
          effects: [
            {
              type: 'condition' as const,
              name: CONDITION.BURNING,
              condition: CONDITION.BURNING,
              stacks: 1,
              duration: 1
            }
          ]
        }
      },
      ...ARTIFACT_END
    ]
  },
  [ID.SKRITT_SWIPE]: {
    stealTraitSkill: true,
    movementSkill: true,
    cooldown: 25,
    initiativeCost: 0,

    castTimeMs: 200,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-swipe' as const } }]
  }
});
