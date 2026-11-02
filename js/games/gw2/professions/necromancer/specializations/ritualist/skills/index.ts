/**
 * Ritualist skill mechanics owned by the Ritualist Necromancer module.
 *
 * The root catalog composes this inert definition with the other active module
 * definitions. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { RITUALIST_SPIRIT_ATTACK_SKILLS } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-attacks.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const RITUALIST_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<NecromancerSkill>>> = {
  [ID.INNERVATE_PRESERVATION]: {
    name: 'Innervate Preservation',
    icon: 'https://render.guildwars2.com/file/0BF19E58712ACF097D0532FB56DBFDB580E3C5BF/3680174.png',
    type: 'Profession',
    slot: 'Profession_4',

    cooldown: 25,
    usableInShroud: true,
    castTimeMs: 0,
    // Commit grants life force, then the Innervate handler applies the party payload.

    effects: [
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ]
  },
  [ID.ESSENCE_BLAST]: {
    name: 'Essence Blast',
    icon: 'https://render.guildwars2.com/file/BC01E1289EC75D7939952FF29B199E55B6C45F0F/3680172.png',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'ritualist',
    shroudSlot: 1,
    castTimeMs: 600,
    interruptCommitMs: 560,
    effects: [
      {
        weaponStrengthProfileId: 'transform.ritualist-shroud',
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        persistsAfterInterrupt: true
      }
    ],
    // Carry the accepted weapon and spirit count into the delayed packet, retaining selected patch data.
    effectVariants: [
      {
        when: () => true,
        transform: (runtime, cast, effects) => {
          const skillWeapon = gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet) || 'Unequipped';
          return effects.map((effect) => ({
            ...effect,
            atMs: ((cast.fullEnd - cast.start) * 1000 * 14) / 15,
            timingAnchor: 'castStart' as const,
            timingScale: 'fixed' as const,
            weapon: skillWeapon,
            weaponStrengthProfileId: weaponStrengthProfileForName(skillWeapon)?.id,
            metadata: {
              activeSpirits: Object.keys(ritualistState.from((runtime as NecromancerRuntime).profession).activeSpirits)
                .length
            }
          }));
        }
      }
    ]
  },
  [ID.ANGUISH]: {
    name: 'Anguish',
    icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
    cooldown: 7,
    // Autonomous payloads and actor tuning belong to the selected actor skill.
    summonAttackId: 'necromancer.ritualist.anguish.autoattack',
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'ritualist',
    shroudSlot: 2,
    castTimeMs: 560,
    interruptMode: 'commit',
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: [],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ritualist.summon-anguish',
          id: 'opening',
          effects: [
            {
              // EVTC calibration identifies each player-owned barrage packet as a 0.36 coefficient strike.
              type: 'strike',
              ticks: [
                { atMs: 800, coefficient: 0.36 },
                { atMs: 960, coefficient: 0.36 },
                { atMs: 1000, coefficient: 0.36 },
                { atMs: 1080, coefficient: 0.36 },
                { atMs: 1120, coefficient: 0.36 },
                { atMs: 1160, coefficient: 0.36 },
                { atMs: 1200, coefficient: 0.36 }
              ],
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              name: 'Anguish Initial Barrage'
            },
            { type: 'condition', name: CONDITION.CRIPPLED, condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 },
            {
              type: 'condition',
              name: CONDITION.VULNERABILITY,
              condition: CONDITION.VULNERABILITY,
              stacks: 8,
              duration: 10
            }
          ]
        }
      }
    ]
  },
  [ID.INNERVATE_WANDERLUST]: {
    name: 'Innervate Wanderlust',
    icon: 'https://render.guildwars2.com/file/CDFE1DF19F0D660091BB935E181745BA0DB6CB47/3680179.png',
    type: 'Profession',
    slot: 'Profession_3',

    cooldown: 15,
    usableInShroud: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 2
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ]
  },
  [ID.NIGHTMARE_WEAPON]: {
    name: 'Nightmare Weapon',
    icon: 'https://render.guildwars2.com/file/B3CF370B0E35DA07C023A4BFAA791809C6A67437/3680180.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    // Each recipient spends charges against this skill's own interval and triggered payload.
    internalCooldown: 0,
    castTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'nightmare-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ritualist.nightmare-weapon',
          id: 'triggered',
          effects: [
            {
              name: 'Strike',
              type: 'strike',
              coefficient: 0,
              hits: 1,
              flatStrikeBase: 1200,
              flatStrikePowerCoeff: 0.05,
              actorType: ACTOR.EFFECT,
              canCrit: false,
              damageKind: 'life-steal'
            },
            {
              name: CONDITION.VULNERABILITY,
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 2,
              duration: 8,
              actorType: ACTOR.EFFECT
            }
          ]
        }
      }
    ]
  },
  [ID.WANDERLUST]: {
    name: 'Wanderlust',
    icon: 'https://render.guildwars2.com/file/604BAC974ED4C76FE95E32BEE6BDB3DE594F9F6C/3680178.png',
    cooldown: 12,
    // Autonomous payloads and actor tuning belong to the selected actor skill.
    summonAttackId: 'necromancer.ritualist.wanderlust.autoattack',
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'ritualist',
    shroudSlot: 3,
    castTimeMs: 760,
    effects: [],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castStart', do: { type: 'ritualist.wanderlust-opening' } },
      {
        on: 'castCommit',
        do: {
          type: 'ritualist.summon-wanderlust',
          id: 'opening',
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              hits: 1,
              atMs: 720,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              name: 'Wanderlust Initial Swing'
            },
            {
              // The lingering field emits four independently timed 0.42 coefficient packets.
              type: 'strike',
              ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 2000 + index * 1000, coefficient: 0.42 })),
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER,
              name: 'Wanderlust Initial Field'
            },
            {
              type: 'condition',
              name: CONDITION.CHILLED,
              condition: CONDITION.CHILLED,
              stacks: 1,
              duration: 2,
              atMs: 0
            },
            {
              type: 'condition',
              name: CONDITION.VULNERABILITY,
              condition: CONDITION.VULNERABILITY,
              stacks: 4,
              duration: 6,
              atMs: 1000
            },
            {
              type: 'condition',
              name: CONDITION.WEAKNESS,
              condition: CONDITION.WEAKNESS,
              stacks: 1,
              duration: 4,
              atMs: 2000
            },
            { type: 'condition', name: CONDITION.SLOW, condition: CONDITION.SLOW, stacks: 1, duration: 2, atMs: 3000 }
          ]
        }
      }
    ]
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    name: "Exit Ritualist's Shroud",
    icon: 'https://render.guildwars2.com/file/01D45B1291F0F369900D94BCD19913074153A54F/3680175.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    shroudExit: 'ritualist',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  },
  [ID.PRESERVATION]: {
    name: 'Preservation',
    icon: 'https://render.guildwars2.com/file/473E92AE33757816B7205C4759F1F3065346E600/3680173.png',
    cooldown: 20,
    // Autonomous payloads and actor tuning belong to the selected actor skill.
    summonAttackId: 'necromancer.ritualist.preservation.autoattack',
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'ritualist',
    shroudSlot: 4,
    castTimeMs: 480,
    // Summoning grants these boons before the spirit's autonomous attack loop starts.
    effects: [
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.summon-preservation', id: 'opening', effects: [] } }]
  },
  [ID.SPLINTER_WEAPON]: {
    name: 'Splinter Weapon',
    icon: 'https://render.guildwars2.com/file/04294CE6BE3BBB314032BD430A631BC614D1E279/3680182.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    // Each recipient spends charges against this skill's own interval and triggered payload.
    internalCooldown: 0.32,
    castTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'splinter-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ritualist.splinter-weapon',
          id: 'triggered',
          effects: [{ name: 'Strike', type: 'strike', coefficient: 0.4, hits: 1, actorType: ACTOR.EFFECT }]
        }
      }
    ]
  },
  [ID.INNERVATE_ANGUISH]: {
    name: 'Innervate Anguish',
    icon: 'https://render.guildwars2.com/file/557413F742FCA13D9A5C08C814F21CA6BCE2626F/3680171.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    usableInShroud: true,
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 1.3, hits: 1 },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 8,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ]
  },
  [ID.SUMMON_SPIRITS]: {
    name: 'Summon Spirits',
    icon: 'https://render.guildwars2.com/file/CF9C5D79940CB74DAA650476DAE9DC012202B86C/3680177.png',
    cooldown: 20,
    // Commanded spirit attacks use this skill-owned strength independently of autonomous attacks.
    weaponStrength: 1056,
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'ritualist',
    shroudSlot: 5,
    castTimeMs: 0,
    effects: [],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ritualist.summon-spirits',
          id: 'commands',
          effects: [
            {
              type: 'strike',
              ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 2.5 / 4 })),
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              duration: 2,
              actorType: ACTOR.PLAYER,
              name: 'Summon Spirits - Anguish'
            },
            {
              type: 'strike',
              coefficient: 3.7,
              hits: 1,
              atMs: 840,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              duration: 1.8,
              actorType: ACTOR.PLAYER,
              name: 'Summon Spirits - Wanderlust'
            }
          ]
        }
      }
    ]
  },
  [ID.RITUALISTS_SHROUD]: {
    name: "Ritualist's Shroud",
    icon: 'https://render.guildwars2.com/file/1B55FB1EE2799643B06A68E3C419D6166A9554AA/3680176.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    shroudEntry: 'ritualist',
    shroudTuning: { kind: 'trait', id: TRAIT.SPAWNING_POWER },
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }]
  },
  [ID.RESILIENT_WEAPON]: {
    name: 'Resilient Weapon',
    icon: 'https://render.guildwars2.com/file/53691A78554BFDCB132CA93F3D3639CC3E4EB2D6/3680169.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 25,
    castTimeMs: 680,
    effects: [
      {
        type: 'buff',
        kind: 'resilient-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.resilient-weapon' } }]
  }
};

/** Spirit bonuses add together, then scale Essence Blast separately from other outgoing damage bonuses. */
export const essenceBlastSpiritModifier: Gw2ModifierRule = {
  id: 'necromancer.essence-blast-active-spirits',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: { damagePerSpirit: 0.15 },
  factor: (context, _target, parameters) =>
    1 + (context.event?.metadata?.activeSpirits || 0) * parameters.damagePerSpirit,
  when: (context) =>
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.ESSENCE_BLAST &&
    (context.event?.metadata?.activeSpirits || 0) > 0
};

/** Intrinsic impact-time formula; the existing modifier registry preserves its operation and ordering. */
export const anguishConditionModifier: Gw2ModifierRule = {
  id: 'necromancer.anguish-conditional-damage',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'damage-additive',
  // Apply the condition bonus; temporary target-control bonuses are outside simulation scope.
  parameters: {
    damagePerCondition: 0.02
  },
  amount: (context, _target, parameters) => targetConditionCount(context) * parameters.damagePerCondition,
  // Existing spirit ownership and attack type identify every non-Innervate Anguish attack, including Summon Spirits.
  when: (context) =>
    context.event?.summonOwner === 'spirit:anguish' && context.event.metadata?.spiritAttackType !== 'innervate'
};

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const RITUALIST_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(RITUALIST_BASE_SKILL_MECHANICS),
  ...RITUALIST_SPIRIT_ATTACK_SKILLS
]);
