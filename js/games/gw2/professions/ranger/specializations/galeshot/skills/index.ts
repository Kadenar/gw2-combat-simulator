import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */

// Cyclone Bow entry and exit are state-selected variants of one F5 UI tile.
const CYCLONE_BOW_PALETTE_TILE = 'galeshot-cyclone-bow';
// Keen Shot flips to Hawkeye at full Wind Force without creating a second weapon tile.
const CYCLONE_BOW_ONE_PALETTE_TILE = 'galeshot-cyclone-bow-one';

/** Both Cyclone Bow variants reset Bluster at commitment when Cloudburst is selected. */
const cloudburstBlusterReset: SkillSideEffect = {
  on: 'castCommit',
  when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
  do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
};

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.WHIRLWIND]: {
    name: 'Whirlwind',
    description: 'Squall. Launch yourself forward with powerful gust of wind.',
    icon: 'https://render.guildwars2.com/file/9A085835726C0C164AFE00FB6D73EE08AC3F031E/3680196.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 25,
    ammoCastLockout: 3,
    ammo: 2,

    evades: true,
    castTimeMs: 500,
    effects: []
  },
  [ID.MISTRAL]: {
    name: 'Mistral',
    description:
      'Squall. Summon a current of chilling northern air. Projectiles that pass through the current become frozen, chilling and dealing additional damage to enemies.',
    icon: 'https://render.guildwars2.com/file/10E31F10E7D84CABF0963FEA12B77EE0BD950E42/3680194.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    // The enhancement window and its missile payload belong to the activating skill.
    duration: 6,
    arrowsRestored: 1,
    castTimeMs: 320,
    effects: [],
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      // Open the enhancement before restoring arrows, matching the activation ordering.
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'ranger.mistral',
          id: 'missile-trigger',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 0.3, hits: 1 },
            { name: CONDITION.CHILLED, type: 'condition', condition: CONDITION.CHILLED, duration: 1, stacks: 1 }
          ]
        }
      },
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    name: 'Summon Cyclone Bow',
    description: 'Conjure a powerful bow of wind that consumes arrows and generates Wind Force.',
    icon: 'https://render.guildwars2.com/file/C7793DFF786C7FE2EC4BF593C0094E07FBE7A943/3680193.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 1,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-enter' } }]
  },
  [ID.PERFECT_STORM]: {
    name: 'Perfect Storm',
    description:
      'Squall. Release a massive tornado, launching enemies it strikes as it travels. When the tornado reaches its destination, it will persist for a period, dealing damage to enemies inside of it.',
    icon: 'https://render.guildwars2.com/file/77FF6D547ED0B09DACB8F5CDDA9424980D4045AD/3680184.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 50,
    arrowsRestored: 2,
    castTimeMs: 600,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2 }],
        name: 'Perfect Storm - Traveling Tornado Damage'
      },
      {
        type: 'strike',
        ticks: [680, 1200, 1720, 2240, 2760, 3280, 3800, 4320, 4840, 5360, 5880, 6400].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        name: 'Perfect Storm - Stationary Tornado Damage'
      },
      {
        type: 'control',
        atMs: 600,
        controlKind: CONTROL.LAUNCH
      }
    ]),
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.WIND_SHEAR]: {
    name: 'Wind Shear',
    description: 'Squall. Wind swells around you, knocking back nearby enemies and reflecting incoming projectiles.',
    icon: 'https://render.guildwars2.com/file/523CB6412D0B1F250FF477DA2EA89A74BA5AE9F0/3680197.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    name: 'Dismiss Cyclone Bow',
    description: 'Dispel your Cyclone Bow, losing all Wind Force.',
    icon: 'https://render.guildwars2.com/file/7414F29508925773FF14E5C67CE9D41C1A13F162/3680192.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 2,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-dismiss' } }]
  },
  [ID.PIERCING_GALES]: {
    name: 'Piercing Gales',
    description:
      'Squall. Conjure a barrage of wind to cut through your target. Deal increased damage against vulnerable foes. The wind flies faster when you have swiftness or superspeed.',
    icon: 'https://render.guildwars2.com/file/33EE3CB700132B5F39FFAD3AF8DF71F7DAFAFD58/3680195.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    arrowsRestored: 1,
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [480, 480, 520, 520, 600].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6
      }
    ],
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.SOOTHING_BREEZE]: {
    name: 'Soothing Breeze',
    description: 'Squall. Call upon a gentle wind to heal and grant superspeed to you and your pet.',
    icon: 'https://render.guildwars2.com/file/43A933E17C3A2B99E0DE675817E73B94B10E29CF/3680185.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 25,
    castTimeMs: 500,
    effects: []
  },
  [ID.KEEN_SHOT]: {
    name: 'Keen Shot',
    description: 'Shoot a wind arrow.',
    icon: 'https://render.guildwars2.com/file/CCBDB172EC3A512C45A9125405AE11993CCCC1A4/3680186.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 1,
    arrowCost: 0,
    castTimeMs: 480,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAWKEYE]: {
    name: 'Hawkeye',
    description: 'Release a hail of arrows toward your target and nearby enemies.',
    icon: 'https://render.guildwars2.com/file/7501721702A2453ED62665041490A4069E6FBBC2/3680191.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 1,
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 2,
    arrowCost: 0,
    castTimeMs: 880,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [800, 920, 1040, 1160, 1280].map((atMs) => ({
          atMs,
          coefficient: 1.36
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // An accepted Hawkeye attempt consumes Wind Force even when interrupted.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.hawkeye' } }]
  },
  [ID.BLUSTER]: {
    name: 'Bluster',
    description: 'Release a rapid volley of arrows.',
    icon: 'https://render.guildwars2.com/file/9A44645021DDF0C10F0D15D0F3900D0FE6E57E69/3680187.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_2',
    cooldown: 3,
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 480,
    castTimeMs: 680,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [520, 600, 640].map((atMs) => ({
          atMs,
          coefficient: 0.64
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.FLEETING_ZEPHYR]: {
    name: 'Fleeting Zephyr',
    description: 'Jump back, releasing a blast of wind.',
    icon: 'https://render.guildwars2.com/file/0E637BE86BAC51085AF40241E9AA9BCFBC2CD3B6/3680188.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_3',
    cooldown: 8,
    evades: true,
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 240,
    castTimeMs: 520,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ],
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.QUARRYS_PERIL]: {
    name: "Quarry's Peril",
    description: 'Fire a volley that immobilizes enemies when it lands.',
    icon: 'https://render.guildwars2.com/file/59A95C37FEB95E03A4C1F853902F553E801DBAA0/3680189.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_4',
    cooldown: 12,
    arrowCost: 2,
    windForceGain: 1,
    windForceApplyMs: 280,
    castTimeMs: 680,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      }
    ],
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ]
  },
  [ID.PELT]: {
    name: 'Pelt',
    description: 'Fire a volley of arrows into the air, damaging enemies when they land.',
    icon: 'https://render.guildwars2.com/file/59A95C37FEB95E03A4C1F853902F553E801DBAA0/3680189.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_4',
    ammo: 2,

    ammoCastLockout: 1,
    cooldown: 12,
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 280,
    castTimeMs: 680,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.SUPERSONIC_ARROW]: {
    name: 'Supersonic Arrow',
    description: 'Supercharge an arrow with wind magic and launch it at incredible speed.',
    icon: 'https://render.guildwars2.com/file/FAAE665D2923D696F00F4AB5160D23DADAD0047A/3680190.png',
    cycloneBowSkill: true,
    type: 'Bundle',
    slot: 'Weapon_5',
    cooldown: 25,
    arrowCost: 3,
    windForceGain: 2,
    windForceApplyMs: 760,
    castTimeMs: 1000,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ],
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ]
  }
});

/** Piercing Gales reads live vulnerability in addition to the ordinary platform multiplier. */
export const piercingGalesModifier: Gw2ModifierRule = {
  id: 'ranger.piercing-gales-vulnerability',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  // Piercing Gales applies its own doubled vulnerability multiplier (2% per
  // stack) in addition to the standard vulnerability already baked into the
  // platform strikeMultiplier, effectively tripling the vulnerability bonus
  // for this skill.
  parameters: {
    baseFactor: 1,
    vulnerabilityPerStack: 0.02
  },
  factor: (context, _target, parameters) =>
    parameters.baseFactor +
    (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) *
      parameters.vulnerabilityPerStack,
  when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.PIERCING_GALES
};
