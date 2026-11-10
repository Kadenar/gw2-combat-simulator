import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { effectTicks, type SkillEffect } from '#gw2/platform/effects/types.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/antiquary/skills/guild-attacks.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Artifact acceptance spends the old pool; traits surround the skill's intrinsic identity at commitment.
const ARTIFACT_START: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'thief.artifact-spend' as const } },
  { on: 'castCommit', do: { type: 'thief.artifact-activated' as const } }
];
const ARTIFACT_END: NonNullable<Skill['sideEffects']> = [
  { on: 'castCommit', do: { type: 'thief.artifact-completed' as const } }
];

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
const ANTIQUARY_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.METAL_LEGION_GUITAR]: {
    name: 'Metal Legion Guitar',
    icon: 'https://render.guildwars2.com/file/02727B1807CF0FEF31037FD9E307BABB2055AE3C/3680214.png',
    type: 'Profession',
    slot: 'Profession_2',

    // The artifact owns the number of stealth attacks granted by its identity window.
    maximumStacks: 2,
    // The artifact owns the lifetime of its stealth attack grant.
    duration: 10,
    cooldown: 0,
    artifactKind: 'offensive',
    castTimeMs: 1920,
    effects: [
      {
        type: 'strike' as const,
        coefficient: 3.2,
        hits: 4,
        atMs: 0,
        name: 'Metal Legion Guitar - Packet 1',
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
        do: { type: 'thief.guitar' as const }
      },
      ...ARTIFACT_END
    ]
  },
  [ID.FORGED_SURFER_DASH]: {
    name: 'Forged Surfer Dash',
    icon: 'https://render.guildwars2.com/file/696501BA136CA660BD22D0D0A3B19741D4A77529/3680211.png',
    type: 'Profession',
    slot: 'Profession_2',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initialDelay: 1,
    pulseInterval: 3,
    duration: 10,
    enhancedDuration: 13,
    maximumDuration: 13,
    movementSkill: true,
    cooldown: 0,
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
            { type: 'condition' as const, name: 'Bomb', condition: CONDITION.BURNING, stacks: 1, duration: 1 },
            ...[
              { type: 'strike' as const, name: 'Dash', coefficient: 2.8, hits: 1 },
              // Meticulous replaces the dash burn with one eight-second stack before expertise.
              { type: 'condition' as const, name: 'Dash', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
              { type: 'strike' as const, name: 'Bomb', coefficient: 1.4, hits: 1 },
              { type: 'condition' as const, name: 'Bomb', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
            ].map((effect) => ({ ...effect, name: 'Meticulous ' + effect.name }))
          ]
        }
      }
    ]
  },
  [ID.HOLO_DANCER_DECOY]: {
    name: 'Holo-Dancer Decoy',
    icon: 'https://render.guildwars2.com/file/CEE6340604724A060D7C570709C4B05DFAD56617/3680212.png',
    type: 'Profession',
    slot: 'Profession_2',
    // The artifact owns its identity window; Meticulous Custodian replaces the duration when selected.
    duration: 10,
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    rechargeMultiplier: 0.2,
    cooldown: 0,
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
    name: 'Exalted Hammer',
    icon: 'https://render.guildwars2.com/file/57A193E75618661CE3F51DC44AC59F7BA72E6169/3680210.png',
    type: 'Profession',
    slot: 'Profession_2',
    movementSkill: true,
    cooldown: 0,
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
    name: 'Stone Summit Cannon',
    icon: 'https://render.guildwars2.com/file/2B551306FBED061EFF9D56E49EE1CEB57309B22C/3680219.png',
    type: 'Utility',
    slot: 'Utility',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    backfireDelay: 2,
    // Acceptance fixes the outcome; even a cancelled use fires from its effective end with fixed profile offsets.
    usableWhileRecharging: true,
    cooldown: 15,
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
      when: (runtime, cast) =>
        Boolean(antiquaryState.from(runtime.profession).backfireState[cast.skill.id]) === backfire,
      transform: (_runtime, cast, effects) => {
        const delay = backfire ? skillNumber(cast.skill, 'backfireDelay') : 0;
        const offsetMs = (cast.effectiveEnd - cast.start + delay) * 1000;
        return effects
          .filter((effect) => effect.packetLabel === (backfire ? 'backfire' : 'success'))
          .map(
            (effect) =>
              ({
                ...effect,
                name: backfire
                  ? 'Stone Summit Cannon - Backfire'
                  : effect.type === 'condition'
                    ? 'Stone Summit Cannon - Burning'
                    : 'Stone Summit Cannon',
                timingAnchor: 'castStart' as const,
                timingScale: 'fixed' as const,
                interruptCommitMs: 0,
                persistsAfterInterrupt: true,
                atMs: offsetMs + (effect.atMs ?? 0),
                ...(effectTicks(effect)
                  ? { ticks: effectTicks(effect)!.map((tick) => ({ ...tick, atMs: offsetMs + tick.atMs })) }
                  : {})
              }) as SkillEffect
          );
      }
    })),
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' as const } }]
  },
  [ID.CHAK_SHIELD]: {
    name: 'Chak Shield',
    icon: 'https://render.guildwars2.com/file/4506224EB1921800602CAD52B6B209960FE51153/3680209.png',
    type: 'Profession',
    slot: 'Profession_2',
    // The artifact owns its identity window; Meticulous Custodian replaces the duration when selected.
    duration: 10,
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    refundCharges: 2,
    maximumStacks: 4,
    cooldown: 0,
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
    name: 'Antivenom Draught: Backfired',
    icon: 'https://render.guildwars2.com/file/51322CD33E32D80B7B341167E6C8A294143264A2/3680207.png',
    type: 'Heal',
    slot: 'Heal',
    patchAuthoringExcluded: true,
    // Backfire states are internal outcomes, not independently equipable loadout choices.
    slotSelectable: false,
    cooldown: 10,
    backfire: true,
    castTimeMs: 520,
    effects: []
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    name: 'Antivenom Draught',
    icon: 'https://render.guildwars2.com/file/51322CD33E32D80B7B341167E6C8A294143264A2/3680207.png',
    type: 'Heal',
    slot: 'Heal',
    usableWhileRecharging: true,
    cooldown: 10,
    castTimeMs: 520,
    effects: [],
    // Fix the outcome at acceptance; cancellation never rerolls or pays coins.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.double-edge' as const } }]
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    name: 'Zephyrite Sun Crystal',
    icon: 'https://render.guildwars2.com/file/3C1B2075B7B164EB2ABE4F6650F553D40F689E53/3680218.png',
    type: 'Profession',
    slot: 'Profession_2',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.packetLabel !== 'meticulous')
      }
    ],
    movementSkill: true,
    cooldown: 1,
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
          ticks: [{ atMs: 400, condition: CONDITION.BURNING, stacks: 1, duration: 4 }],
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
    name: 'Unstable Skritt Bomb',
    icon: 'https://render.guildwars2.com/file/0FBFB6FA27C9BEBD1872DAACDB040AEA71A616A9/3680208.png',
    type: 'Profession',
    slot: 'Profession_2',
    slotSelectable: false,
    artifactKind: 'unstable',
    cooldown: 0,
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
    name: 'Reshuffle',
    icon: 'https://render.guildwars2.com/file/EAD4D329B407462E114B30800D02E25598C8C3A1/3680216.png',
    type: 'Profession',
    slot: 'Profession_4',
    cost: { resource: 'initiative', amount: 2 },

    cooldown: 5,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.reshuffle' as const } }]
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    name: 'Stone Summit Cannon',
    icon: 'https://render.guildwars2.com/file/2B551306FBED061EFF9D56E49EE1CEB57309B22C/3680219.png',
    type: 'Utility',
    slot: 'Utility',
    patchAuthoringExcluded: true,
    // Only the usable cannon is selectable, even though its disabled backfire state shares the same name.
    slotSelectable: false,
    cooldown: 15,
    backfire: true,
    castTimeMs: 360,
    effects: []
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    name: 'Summon Kryptis Turret',
    icon: 'https://render.guildwars2.com/file/2DC92035E3A36CBCDB62C84E65BEF69BFA0BDD02/3680213.png',
    type: 'Profession',
    slot: 'Profession_2',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 8,
    cooldown: 0,
    artifactKind: 'offensive',
    castTimeMs: 440,
    // The artifact grants a timed player-owned strike bonus across skills.
    modifiers: [
      {
        order: 403,
        id: 'thief.kryptis-turret-damage',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.15,
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          (thiefRuntimeSpecializationState(context.runtime?.profession, 'Antiquary').kryptisDamageUntil || 0) >
            context.time
      }
    ],
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
          duration: 2
        })),
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: [...ARTIFACT_START, { on: 'castCommit', do: { type: 'thief.kryptis' as const } }, ...ARTIFACT_END]
  },
  [ID.CANACH_COIN_TOSS]: {
    name: 'Canach-Coin Toss',
    icon: 'https://render.guildwars2.com/file/CA51F09750F4C7C70A546E9F040EEF2977370DFF/3680220.png',
    type: 'Utility',
    slot: 'Utility',
    usableWhileRecharging: true,
    cooldown: 15,
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
    name: 'Skritt Scuffle',
    icon: 'https://render.guildwars2.com/file/697095D59F91E5085007FE240105CAFF64BD0B2A/3680206.png',
    type: 'Elite',
    slot: 'Elite',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 15,
    pulseInterval: 3,
    cooldown: 50,
    castTimeMs: 560,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-scuffle' as const } }]
  },
  [ID.MISTBURN_MORTAR]: {
    name: 'Mistburn Mortar',
    icon: 'https://render.guildwars2.com/file/4519AE3A9032E03F2F14AAA1B5EEE10F1AF1EEAE/3680215.png',
    type: 'Profession',
    slot: 'Profession_2',
    // The artifact owns its identity window; Meticulous Custodian replaces the duration when selected.
    duration: 10,
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    maximumStacks: 5,
    cooldown: 0,
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
    name: 'Skritt Swipe',
    icon: 'https://render.guildwars2.com/file/291DAF077409087C5905700A785E4EDDC9DBC47A/3680217.png',
    type: 'Profession',
    slot: 'Profession_1',
    stealTraitSkill: true,
    movementSkill: true,
    cooldown: 25,
    castTimeMs: 200,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.skritt-swipe' as const } }]
  }
};

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const ANTIQUARY_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(ANTIQUARY_SKILL_MECHANICS),
  ...ANTIQUARY_GUILD_ATTACK_SKILLS
]);
