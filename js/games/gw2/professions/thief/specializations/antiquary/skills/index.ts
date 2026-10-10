import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

// Artifact acceptance spends the old pool; traits surround the skill's intrinsic identity at commitment.
const ARTIFACT_START: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'thief.artifact-spend' } },
  { on: 'castCommit', do: { type: 'thief.artifact-activated' } }
];
const ARTIFACT_END: NonNullable<Skill['sideEffects']> = [
  { on: 'castCommit', do: { type: 'thief.artifact-completed' } }
];

// Both API IDs share the primary definition so future timing fixes cannot leave the alias behind.
const METAL_LEGION_GUITAR_SKILL: Partial<Skill> = {
  sideEffects: [
    ...ARTIFACT_START,
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.METAL_LEGION_GUITAR,
      do: { type: 'thief.guitar' }
    },
    ...ARTIFACT_END
  ],

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
      // Meticulous Custodian keys its separate final-hit factor on this packet identity, not the display label.
      metadata: { packetKind: 'thief.metal-legion-guitar-final-smash' },
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
    sideEffects: [
      ...ARTIFACT_START,
      { on: 'castCommit', do: { type: 'thief.surfer-window' } },
      ...ARTIFACT_END,
      { on: 'castCommit', do: { type: 'thief.forged-surfer' } }
    ],
    movementSkill: true,

    castTimeMs: 200,
    // The buff and bomb sequence commit before the dash ends, while its remaining animation still locks casting.
    interruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [],
    artifactKind: 'offensive'
  },
  [ID.HOLO_DANCER_DECOY]: {
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.holo' } }, ...ARTIFACT_END],

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
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END],
    movementSkill: true,

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
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' } }],
    // Acceptance fixes the outcome; even a cancelled use fires from its effective end with fixed profile offsets.
    usableWhileRecharging: true,
    castTimeMs: 520,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    effectVariants: [true, false].map<NonNullable<Skill['effectVariants']>[number]>((backfire) => ({
      when: (runtime, cast) => Boolean(antiquaryState.from(runtime).backfireState[cast.skill.id]) === backfire,
      profileId: backfire ? PROFILE.cannonBackfire : PROFILE.cannonSuccess,
      transform: (runtime, cast, effects) => {
        const delay = backfire
          ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.cannonBackfire), 'initialDelay')
          : 0;
        const offsetMs = (cast.effectiveEnd - cast.start + delay) * 1000;
        return effects.map((effect) => ({
          ...effect,
          name: backfire
            ? 'Stone Summit Cannon — Backfire'
            : effect.type === 'condition'
              ? 'Stone Summit Cannon — Burning'
              : 'Stone Summit Cannon',
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          interruptCommitMs: 0,
          persistsAfterInterrupt: true,
          atMs: offsetMs + (effect.atMs ?? 0),
          ...(Array.isArray(effect.ticks)
            ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: offsetMs + tick.atMs })) }
            : {})
        }));
      }
    }))
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733]: {
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END],
    movementSkill: true,

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
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 4,
        actorType: 'player'
      }
    ]),
    artifactKind: 'defensive'
  },
  [ID.CHAK_SHIELD]: {
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.chak' } }, ...ARTIFACT_END],

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
    // Backfire states are internal outcomes, not independently equipable loadout choices.
    slotSelectable: false,
    castTimeMs: 520,
    cooldown: 10,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' } }],

    usableWhileRecharging: true,
    castTimeMs: 520,
    cooldown: 10,
    initiativeCost: 0,
    effects: []
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    sideEffects: [...ARTIFACT_START, ...ARTIFACT_END],
    movementSkill: true,

    castTimeMs: 240,
    // The arrival commits before the dash animation ends; its launched effects keep the remaining cast lockout.
    interruptCommitMs: 160,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
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
        ticks: [{ atMs: 400, condition: 'Burning', stacks: 2, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]),
    artifactKind: 'defensive'
  },
  [ID.UNSTABLE_SKRITT_BOMB]: {
    // Scuffle grants this manually activated backfire in place of an artifact; using it spends the held grant.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.artifact-spend' } }],
    slotSelectable: false,
    artifactKind: 'unstable',
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
    ]
  },
  [ID.RESHUFFLE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.reshuffle' } }],

    castTimeMs: 0,
    cooldown: 5,
    initiativeCost: 2,
    effects: []
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    // Only the usable cannon is selectable, even though its disabled backfire state shares the same name.
    slotSelectable: false,
    castTimeMs: 360,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.kryptis' } }, ...ARTIFACT_END],

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
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [
      { on: 'castStart', do: { type: 'thief.double-edge' } },
      { on: 'castStart', do: { type: 'thief.roll-coins' } },
      { on: 'castCommit', do: { type: 'thief.pay-coins' } }
    ],

    usableWhileRecharging: true,
    castTimeMs: 0,
    cooldown: 15,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKRITT_SCUFFLE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-scuffle' } }],

    castTimeMs: 560,
    cooldown: 50,
    initiativeCost: 0,
    effects: []
  },
  [ID.MISTBURN_MORTAR]: {
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.mortar' } }, ...ARTIFACT_END],

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
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-swipe' } }],
    stealTraitSkill: true,
    movementSkill: true,

    castTimeMs: 200,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  }
});
