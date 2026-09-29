import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { dragonSlashReleases } from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { resolveSharpAsTheWindSkillId } from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';

/** Owns this trait's tuning and selected contributions. */
export const unseenSword = defineTrait({
  id: TRAIT.UNSEEN_SWORD,
  name: 'Unseen Sword',
  balance: {
    internalCooldown: 4,
    // Entry traits declare their own flow window so patches can remove it independently.
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.2, hits: 1 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const sharpAsTheWind = defineTrait({
  id: TRAIT.SHARP_AS_THE_WIND,
  name: 'Sharp as the Wind',
  balance: {
    internalCooldown: 4,
    effects: [
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  },
  hooks: { modifySkillId: resolveSharpAsTheWindSkillId }
});

/** Owns this trait's tuning and selected contributions. */
export const riversFlow = defineTrait({
  id: TRAIT.RIVERS_FLOW,
  name: "River's Flow",
  balance: {
    internalCooldown: 4,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 8 },
      { name: 'positive-flow', type: 'buff', kind: 'positive-flow', stacks: 2, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const dragonscaleDefense = defineTrait({
  id: TRAIT.DRAGONSCALE_DEFENSE,
  name: 'Dragonscale Defense',
  balance: {
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 0,

      emit: TRAIT.DRAGONSCALE_DEFENSE,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.DRAGON_TRIGGER,
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const fierceAsFire = defineTrait({
  id: TRAIT.FIERCE_AS_FIRE,
  name: 'Fierce as Fire',
  balance: {
    // Damage, presentation, and tooltip consumers share this trait's balance values.
    maximumStacks: 10,
    damageIncreasePerStack: 0.01,
    effects: [{ name: 'fierce-as-fire', type: 'buff', kind: 'fierce-as-fire', stacks: 1, duration: 15 }]
  },
  modifierRules: [
    {
      order: 10,
      id: 'warrior.fierce-as-fire',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Apply profile tuning to live self stacks, preserving Core Warrior's stack and expiry policy.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.FIERCE_AS_FIRE);
        return (
          warriorActiveBuffStacks(context, 'fierce-as-fire', balanceProfileNumber(profile, 'maximumStacks')) *
          balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const lushForest = defineTrait({
  id: TRAIT.LUSH_FOREST,
  name: 'Lush Forest',
  balance: {
    rechargeReduction: 0.75
  }
});

/** Owns this trait's tuning and selected contributions. */
export const daringDragon = defineTrait({
  id: TRAIT.DARING_DRAGON,
  name: 'Daring Dragon',
  balance: {
    resourceCostMultiplier: 2,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 10,
        audience: { recipients: 'party' },
        packetLabel: 'on Dragon Slash release'
      }
    ]
  },
  triggers: [
    {
      order: 1,

      emit: TRAIT.DARING_DRAGON,
      on: 'castCommit',
      when: (_runtime, cast) => dragonSlashReleases.has(cast),
      effects: (effect) => effect.type === 'boon' || effect.type === 'buff',
      attribution: { priority: 0, audience: { recipients: 'party' } }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const gunsAndGlory = defineTrait({
  id: TRAIT.GUNS_AND_GLORY,
  name: 'Guns and Glory',
  balance: {
    attributeBonus: 250,
    maximumStacks: 12,
    resourceGain: 3
  }
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const gunXSword = defineTrait({ id: TRAIT.GUN_X_SWORD, name: 'Gun X Sword' });

/** Add the selected stun to the authored Dragon Slash release. */
export const unyieldingDragon = defineTrait({
  id: TRAIT.UNYIELDING_DRAGON,
  name: 'Unyielding Dragon',
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (!cast.skill.dragonSlash || !hasTrait(runtime, TRAIT.UNYIELDING_DRAGON)) return effects;
      const strike = effects.find((effect) => effect.type === 'strike');
      return [
        ...effects,
        {
          type: 'control',
          source: 'Trait',
          sourceId: TRAIT.UNYIELDING_DRAGON,
          controlKind: 'stun',
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          atMs: strike?.atMs
        }
      ];
    }
  }
});

/** Register native owners once in declaration order. */
export const warriorBladeswornTraits = [
  unyieldingDragon,
  gunXSword,
  unseenSword,
  sharpAsTheWind,
  riversFlow,
  dragonscaleDefense,
  fierceAsFire,
  lushForest,
  daringDragon,
  gunsAndGlory
] as const;
