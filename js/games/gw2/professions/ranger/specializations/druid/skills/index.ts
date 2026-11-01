/** Explicit PvE skill mechanics owned by the Druid Ranger module. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Native and Eclipse effects share the impact, independently of the Avatar animation ending.
export const SEED_OF_LIFE_DETONATION_MS = 720;

export const LUNAR_IMPACT_HIT_MS = 560;

export const DRUID_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.GLYPH_OF_REJUVENATION]: {
    name: 'Glyph of Rejuvenation',
    description: 'Glyph. Greatly heal yourself and your pet, while healing nearby allies for a minor amount.',
    icon: 'https://render.guildwars2.com/file/0A3119FC4F62C31A0646B0FF901E701D74BD3EEA/1128605.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    castTimeMs: 333,
    effects: []
  },
  [ID.RELEASE_CELESTIAL_AVATAR]: {
    name: 'Release Celestial Avatar',
    description: 'Leave the celestial avatar form.',
    icon: 'https://render.guildwars2.com/file/695007D6D2010F49499B43A7EDC3A4701D450F4C/1128602.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 0,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Use the common form lifecycle for manual entry/release and resource depletion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.avatar-release' } }]
  },
  [ID.GLYPH_OF_THE_STARS]: {
    name: 'Glyph of the Stars',
    description: 'Glyph. Channel the power of the stars to prevent harm to your allies.',
    icon: 'https://render.guildwars2.com/file/E04535E0710904BE9841BAC49922200E39B9B413/1128636.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 48,
    castTimeMs: 667,
    effects: []
  },
  [ID.CELESTIAL_AVATAR]: {
    name: 'Celestial Avatar',
    description: 'Consume your accumulated astral force to become a celestial avatar.',
    icon: 'https://render.guildwars2.com/file/0C47C53B414ADB3DA62C47679A6C09B4FB0534D3/1128603.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 10,
    // The form owns its maximum window; its resource clock derives depletion from this duration.
    duration: 15,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Use the common form lifecycle for manual entry/release and resource depletion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.avatar-enter' } }]
  },
  [ID.COSMIC_RAY]: {
    name: 'Cosmic Ray',
    description: 'Call down energy onto the targeted area to heal allies.',
    icon: 'https://render.guildwars2.com/file/ADD8B8B5B1EA72760ABB7313EAA8B0DAEC135F5E/1128620.png',
    celestialAvatarSkill: true,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    effects: []
  },
  [ID.SEED_OF_LIFE]: {
    name: 'Seed of Life',
    description: 'Summon a seed that heals and cleanses nearby allies when it blossoms.',
    icon: 'https://render.guildwars2.com/file/761706674AF9092C98D059AB03BD747BFC7DF506/1128623.png',
    celestialAvatarSkill: true,
    type: 'Bundle',
    slot: 'Weapon_2',
    cooldown: 4,
    castTimeMs: 0,
    canCastConcurrently: true,
    // The planted seed detonates later, including after the player releases Celestial Avatar.
    effects: impactEffects({ atMs: SEED_OF_LIFE_DETONATION_MS, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.LUNAR_IMPACT]: {
    name: 'Lunar Impact',
    description: 'Call down a massive lunar beam to heal allies and daze foes.',
    icon: 'https://render.guildwars2.com/file/2708F4B3239D05C7A063FDC37838C9EFF5FCED50/1128625.png',
    celestialAvatarSkill: true,
    type: 'Bundle',
    slot: 'Weapon_3',
    cooldown: 8,
    // Match the measured Quickness animation from the condition Druid EVTC.
    castTimeMs: 920,
    // The impact commits before the remaining animation, so cancelling the aftercast retains its effects.
    interruptCommitMs: LUNAR_IMPACT_HIT_MS,
    effects: impactEffects({ atMs: LUNAR_IMPACT_HIT_MS, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'control',
        controlKind: CONTROL.DAZE,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      }
    ])
  },
  [ID.REJUVENATING_TIDES]: {
    name: 'Rejuvenating Tides',
    description: 'Gather tidal force to rapidly heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/0C909F99672AC81E95167114B132F4BF03296E33/1128626.png',
    celestialAvatarSkill: true,
    type: 'Bundle',
    slot: 'Weapon_4',
    cooldown: 8,
    castTimeMs: 480,
    // A committed cast keeps its delayed pulses and remaining animation lockout after interruption.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1,
        applications: 5,
        atMs: 960,
        intervalMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.NATURAL_CONVERGENCE]: {
    name: 'Natural Convergence',
    description: 'Channel celestial power, then trap foes in a black hole.',
    icon: 'https://render.guildwars2.com/file/08A7C5E751190ED5596C9112005D791D20AA3B31/1128629.png',
    celestialAvatarSkill: true,
    type: 'Bundle',
    slot: 'Weapon_5',
    cooldown: 10,
    castTimeMs: 2080,
    // Channel impacts resolve as they occur; only the final impact releases the persistent Black Hole.
    interruptCommitMs: 520,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        ticks: [520, 1160, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.75
        }))
      },
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        ticks: [{ atMs: 2040, coefficient: 2 }]
      },
      {
        type: 'condition',
        ticks: [520, 1160, 1640, 2040].flatMap((atMs) => [
          {
            atMs,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 1
          },
          { atMs, condition: CONDITION.SLOW, stacks: 1, duration: 1 }
        ])
      },
      {
        weaponStrengthProfileId: 'transform.celestial-avatar',
        type: 'strike',
        name: 'Black Hole',
        // This child effect has no catalog entry, so carry its dedicated icon into damage breakdown rows.
        icon: new URL('@images/wiki/black-hole.png', import.meta.url).href,
        sourceId: ID.BLACK_HOLE,
        interruptCommitMs: 2040,
        persistsAfterInterrupt: true,
        skillName: 'Black Hole',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        canCrit: false,
        ticks: [2640, 4160, 5680, 7200].map((atMs) => ({
          atMs,
          coefficient: 0,
          flatDamage: 158,
          canCrit: false
        }))
      },
      {
        // Each Black Hole pulse immobilizes once; there is no additional pull to trigger Blood Moon.
        type: 'condition',
        name: 'Black Hole',
        sourceId: ID.BLACK_HOLE,
        interruptCommitMs: 2040,
        persistsAfterInterrupt: true,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        applications: 4,
        atMs: 2640,
        intervalMs: 1520,
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        skillName: 'Black Hole'
      },
      ...[520, 1160, 1640, 2040].map((atMs) => ({
        type: 'boon' as const,
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1,
        atMs,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }))
    ])
  }
});
