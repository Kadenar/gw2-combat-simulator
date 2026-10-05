import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { weaponStrengthProfileForName } from '#gw2/platform/equipment/weapons/strength.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
/**
 * Ritualist skill mechanics owned by the Ritualist Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

export const RITUALIST_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.INNERVATE_PRESERVATION]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,
    // Commit grants life force, then the Innervate handler applies the party payload.

    effects: [
      { type: 'boon', boon: 'aegis', duration: 3, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ],
    usableInShroud: true
  },
  [ID.SUMMON_SPIRITS]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.summon-spirits' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'ritualist',
    shroudSlot: 5,
    specialization: 'Ritualist'
  },
  [ID.PRESERVATION]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.summon-preservation' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 480,
    // Summoning grants these boons before the spirit's autonomous attack loop starts.
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      { type: 'boon', boon: 'vigor', duration: 4, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } }
    ],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'ritualist',
    shroudSlot: 4,
    specialization: 'Ritualist'
  },
  [ID.INNERVATE_WANDERLUST]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,

    effects: [
      {
        type: 'condition',
        condition: 'Fear',
        stacks: 1,
        duration: 2
      }
    ],
    usableInShroud: true
  },
  [ID.NIGHTMARE_WEAPON]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.nightmare-weapon' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'nightmare-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  [ID.ANGUISH]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.summon-anguish' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 560,
    // Benchmark logs spawn the spirit ~480 ms into every cast, including casts whose aftercast is cancelled.
    interruptCommitMs: 480,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'ritualist',
    shroudSlot: 2,
    specialization: 'Ritualist'
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }],
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Ritualist',
    shroudExit: 'ritualist',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap'
  },
  [ID.WANDERLUST]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castStart', do: { type: 'ritualist.wanderlust-opening' } },
      { on: 'castCommit', do: { type: 'ritualist.summon-wanderlust' } }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 760,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'ritualist',
    shroudSlot: 3,
    specialization: 'Ritualist'
  },
  [ID.SPLINTER_WEAPON]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.splinter-weapon' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 240,
    effects: [
      {
        type: 'buff',
        kind: 'splinter-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  [ID.INNERVATE_ANGUISH]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [
      { on: 'castCommit', do: lifeForceGrant({ id: 'innervate', unit: 'cast', grant: { percent: 10 } }) },
      { on: 'castCommit', do: { type: 'ritualist.innervate' } }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 0,

    effects: [
      { type: 'strike', coefficient: 1.3, hits: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 8, audience: { recipients: 'party', maximumRecipients: 5 } },
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1, audience: { recipients: 'party', maximumRecipients: 5 } }
    ],
    usableInShroud: true
  },
  [ID.ESSENCE_BLAST]: {
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
              activeSpirits: Object.keys(ritualistState.from(runtime as NecromancerRuntime).activeSpirits).length
            }
          }));
        }
      }
    ],
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'ritualist',
    shroudSlot: 1,
    specialization: 'Ritualist'
  },
  [ID.RITUALISTS_SHROUD]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }],
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Ritualist',
    shroudEntry: 'ritualist',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap'
  },
  [ID.RESILIENT_WEAPON]: {
    // This definition selects its producer; shared owners retain recipients, charge pools, and creature lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ritualist.resilient-weapon' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    effects: [
      {
        type: 'buff',
        kind: 'resilient-weapon',
        duration: 10,
        stacks: 5,
        allyStacks: 3,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  }
});

/** Intrinsic impact-time formula; the existing modifier registry preserves its operation and ordering. */
export const essenceBlastSpiritModifier: Gw2ModifierRule = {
  id: 'necromancer.essence-blast-active-spirits',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'damage-additive',
  parameters: { damagePerSpirit: 0.15 },
  amount: (context, _target, parameters) => (context.event?.metadata?.activeSpirits || 0) * parameters.damagePerSpirit,
  when: (context) => eventSkill(context)?.id === ID.ESSENCE_BLAST && (context.event?.metadata?.activeSpirits || 0) > 0
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
  // Every non-Innervate Anguish attack carries the flag, including Summon Spirits.
  when: (context) => Boolean(context.event?.metadata?.anguishConditionalDamage)
};
