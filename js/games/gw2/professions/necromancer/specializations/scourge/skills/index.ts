/**
 * Scourge skill mechanics owned by the Scourge Necromancer module.
 *
 * The root catalog composes this inert definition with the other active module
 * definitions. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

// Intrinsic applications are removable effects, so only delivered barriers can trigger traits.
const barrier: SkillEffect = {
  type: 'buff',
  name: 'barrier',
  kind: 'barrier',
  stacks: 1,
  duration: 5,
  atMs: 0,
  timingAnchor: 'castEnd',
  timingScale: 'fixed',
  audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
};

// Herald of Sorrow swaps Desert Shroud for Sandstorm Shroud; both are state-selected variants of one UI tile.
const SCOURGE_SHROUD_PALETTE_TILE = 'scourge-desert-shroud';

export const SCOURGE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<NecromancerSkill>>> = {
  [ID.NEFARIOUS_FAVOR]: {
    name: 'Nefarious Favor',
    icon: 'https://render.guildwars2.com/file/076FD4FE99097163B3A861CDDEEE15C460E80FA8/1770537.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 5,
    // Author costs as rounded whole points so admission, payment, and tooltips agree independently of build capacity.
    cost: { resource: 'lifeForce', amount: 1935 },
    castTimeMs: 0,
    effects: [],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.cleanse' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } }
    ]
  },
  [ID.SERPENT_SIPHON]: {
    name: 'Serpent Siphon',
    icon: 'https://render.guildwars2.com/file/BFA50C4A02B565C5945562397CC3BEEFA11080C8/1770545.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    castTimeMs: 360,
    effects: [
      barrier,
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.GHASTLY_BREACH]: {
    name: 'Ghastly Breach',
    icon: 'https://render.guildwars2.com/file/EA63481E9139E96B0EDDAF1CCBA317F84B6D6C04/1770533.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 60,
    castTimeMs: 680,
    comboFields: [{ ownerId: 'necromancer', fieldType: COMBO_FIELD.DARK, duration: 5, startAnchor: 'castEnd' }],
    // Five fixed pulses share strike, condition, and ally-boon timing; boon-conversion Torment is not simulated.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.5 / 5 }))
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 2,
        duration: 6,
        applications: 5,
        intervalMs: 1000,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ])
  },
  [ID.DESICCATE]: {
    name: 'Desiccate',
    icon: 'https://render.guildwars2.com/file/7FAE663D18010ECB183436E00B4532900A941292/1770542.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 16,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 } })]
          }
        ],
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_FLARE]: {
    name: 'Sand Flare',
    icon: 'https://render.guildwars2.com/file/3EC7DEC937399308804BB1EA67FC063BA89CB553/1770534.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 25,
    castTimeMs: 680,
    effects: [
      barrier,
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_CASCADE]: {
    name: 'Sand Cascade',
    icon: 'https://render.guildwars2.com/file/BD17FADB77385D459141BC62BBFDDE2D68C8480B/1770538.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 10,
    cost: { resource: 'lifeForce', amount: 2487 },
    castTimeMs: 0,
    effects: [barrier],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [{ on: 'castCommit', do: { type: 'scourge.strike' } }]
  },
  [ID.GARISH_PILLAR]: {
    name: 'Garish Pillar',
    icon: 'https://render.guildwars2.com/file/DFBEE101026A00E7AF0E1A023F6B21E291650795/1770536.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 15,
    // The lifecycle action owns deferred packets; shared commands read this selected skill.

    cost: { resource: 'lifeForce', amount: 3685 },
    castTimeMs: 0,
    effects: [],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      {
        on: 'castCommit',
        do: {
          type: 'scourge.garish-pillar',
          id: 'garishPillar',
          effects: [
            {
              name: CONDITION.FEAR,
              type: 'condition',
              condition: CONDITION.FEAR,
              stacks: 1,
              duration: 1,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.DESERT_SHROUD]: {
    name: 'Desert Shroud',
    icon: 'https://render.guildwars2.com/file/69DCF8665579C993C2C50AD9073009712FC344EE/1770535.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 20,
    // The lifecycle action owns deferred packets; shared commands read this selected skill.
    impactDelayMs: 520,
    cost: { resource: 'lifeForce', amount: 4606 },
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1,
    castTimeMs: 0,
    effects: [barrier],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      {
        on: 'castCommit',
        do: {
          type: 'scourge.desert-shroud',
          id: 'desertShroud',
          effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
            {
              name: 'Strike',
              type: 'strike',
              ticks: Array.from({ length: 7 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.15 / 7 })),
              actorType: ACTOR.PLAYER
            },
            {
              name: CONDITION.TORMENT,
              type: 'condition',
              condition: CONDITION.TORMENT,
              stacks: 1,
              duration: 5,
              applications: 7,
              intervalMs: 1000,
              actorType: ACTOR.PLAYER
            }
          ])
        }
      }
    ]
  },
  [ID.MANIFEST_SAND_SHADE]: {
    name: 'Manifest Sand Shade',
    icon: 'https://render.guildwars2.com/file/E15557DE4FC766EE28E31F73B3125FDC1AEFE608/1770539.png',
    type: 'Profession',
    slot: 'Profession_1',
    ammoCastLockout: 0,
    // The lifecycle action owns deferred packets; shared commands read this selected skill.
    maximumStacks: 3,
    dhuumfireDuration: 2,
    dhuumfireInterval: 1,
    cooldown: 15,
    ammo: 3,
    castTimeMs: 480,
    effects: [],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'scourge.manifest-start' } },
      {
        on: 'castCommit',
        do: {
          type: 'scourge.manifest',
          id: 'shade',
          effects: [
            {
              name: 'Strike',
              type: 'strike',
              coefficient: 0.666,
              hits: 1,
              actorType: ACTOR.PLAYER
            },
            {
              name: CONDITION.TORMENT,
              type: 'condition',
              condition: CONDITION.TORMENT,
              stacks: 1,
              duration: 2,
              actorType: ACTOR.PLAYER
            },
            {
              name: 'active-shade',
              type: 'buff',
              kind: 'active-shade',
              stacks: 1,
              duration: 15,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.SANDSTORM_SHROUD]: {
    name: 'Sandstorm Shroud',
    icon: 'https://render.guildwars2.com/file/67EF1250A2BE9C00B9B3F462C00696BFC1E0BFAD/2110169.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 20,
    // The lifecycle action owns deferred packets; shared commands read this selected skill.

    cost: { resource: 'lifeForce', amount: 3224 },
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2,
    castTimeMs: 0,
    effects: [],
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      {
        on: 'castCommit',
        do: {
          type: 'scourge.sandstorm-shroud',
          id: 'sandstormShroud',
          effects: [
            ...impactEffects({ atMs: 3500, timingAnchor: 'castStart', timingScale: 'fixed' }, [
              { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: ACTOR.PLAYER },
              {
                name: CONDITION.TORMENT,
                type: 'condition',
                condition: CONDITION.TORMENT,
                stacks: 6,
                duration: 5,
                actorType: ACTOR.PLAYER
              }
            ]),
            {
              // Barrier is independent of Protection; its accepted application owns the trait rewards at each pulse.
              name: 'barrier pulses',
              type: 'buff',
              kind: 'barrier',
              stacks: 1,
              duration: 5,
              applications: 3,
              intervalMs: 1000,
              timingAnchor: 'castEnd',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              audience: { recipients: RECIPIENT.PARTY }
            },
            {
              name: 'protection pulses',
              type: 'boon',
              boon: BOON.PROTECTION,
              stacks: 1,
              duration: 1.5,
              applications: 3,
              intervalMs: 1000,
              timingAnchor: 'castEnd',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              audience: { recipients: RECIPIENT.PARTY }
            },
            {
              name: 'barrier detonation',
              type: 'buff',
              kind: 'barrier',
              stacks: 1,
              duration: 5,
              atMs: 3500,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              audience: { recipients: RECIPIENT.PARTY }
            },
            {
              name: boonKey(BOON.PROTECTION),
              type: 'boon',
              boon: BOON.PROTECTION,
              stacks: 1,
              duration: 3,
              atMs: 3500,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              audience: { recipients: RECIPIENT.PARTY }
            }
          ]
        }
      }
    ]
  }
};
