import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey, GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { extendPeriodicEffects } from '#gw2/platform/effects/periodic.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  defineTrait,
  traitAttributeEffects,
  traitSkillReplacement
} from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { virtueActivated, type VirtueActivation } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianResolutionMultiplier } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_TRAIT_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Owns Permeating Wrath tuning and behavior at its existing mechanic boundaries. */
export const permeatingWrath = defineTrait({
  name: 'Permeating Wrath',
  id: GUARDIAN_TRAIT_IDS.PERMEATING_WRATH,
  balance: { threshold: 3 }
});

/** Owns Inspired Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiredVirtue = defineTrait({
  name: 'Inspired Virtue',
  id: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
  balance: {
    damagePerBoon: 0.005,
    maximumBoons: GW2_STANDARD_BOONS.length,
    effects: [
      { type: 'boon', name: boonKey(BOON.MIGHT), boon: BOON.MIGHT, stacks: 3, duration: 5 },
      { type: 'boon', name: boonKey(BOON.REGENERATION), boon: BOON.REGENERATION, stacks: 1, duration: 5 },
      { type: 'boon', name: boonKey(BOON.PROTECTION), boon: BOON.PROTECTION, stacks: 1, duration: 5 }
    ]
  },
  modifierRules: [
    {
      order: -13,
      id: 'guardian.inspired-virtue',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // Boon bonuses sum within this trait, then multiply the outgoing additive bucket.
      operation: 'multiply',
      // Live counts every standard boon; previews can lower the cap independently of the per-boon bonus.

      factor: (context) =>
        1 +
        Math.min(
          balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE, 'maximumBoons'),
          countActiveBoons(context, { actor: ACTOR.PLAYER }, (boon) => guardianBoonActive(context, boon))
        ) *
          balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE, 'damagePerBoon')
    }
  ],
  // Each virtue grants its own party boon.
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: GuardianRuntime, { cast, virtue }: VirtueActivation) =>
        virtueBuff(
          runtime,
          cast,
          GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
          virtue === 'justice'
            ? boonKey(BOON.MIGHT)
            : virtue === 'resolve'
              ? boonKey(BOON.REGENERATION)
              : boonKey(BOON.PROTECTION),
          true
        )
    })
  ]
});

/** Owns Virtue of Resolution tuning and behavior at its existing mechanic boundaries. */
export const virtueOfResolution = defineTrait({
  name: 'Virtue of Resolution',
  id: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
  balance: {
    durationMultiplier: 1.25,
    effects: [{ type: 'boon', name: boonKey(BOON.RESOLUTION), boon: BOON.RESOLUTION, stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: GuardianRuntime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION, boonKey(BOON.RESOLUTION))
    })
  ],
  hooks: {
    /** Resolution samples this multiplier once when the shared service applies a boon. */
    boonDuration(runtime, event, _baseDuration, scaledDuration) {
      return event.kind === boonKey(BOON.RESOLUTION)
        ? scaledDuration * guardianResolutionMultiplier(runtime)
        : scaledDuration;
    }
  }
});

/** Owns Inspiring Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiringVirtue = defineTrait({
  name: 'Inspiring Virtue',
  id: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
  balance: {
    damageIncrease: 0.1,
    effects: [
      {
        type: 'buff',
        name: 'guardian-inspiring-virtue',
        kind: 'guardian-inspiring-virtue',
        stacks: 1,
        duration: 6
      }
    ]
  },
  modifierRules: [
    {
      order: -10,
      id: 'guardian.inspiring-virtue',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE, 'damageIncrease'),
      when: (context) => buffActive(context, 'guardian-inspiring-virtue')
    }
  ],
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: GuardianRuntime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE, 'guardian-inspiring-virtue')
    })
  ]
});

/** Owns Indomitable Courage tuning and behavior at its existing mechanic boundaries. */
export const indomitableCourage = defineTrait({
  name: 'Indomitable Courage',
  id: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
  balance: {
    pulseInterval: 30,
    effects: [{ type: 'boon', name: boonKey(BOON.STABILITY), boon: BOON.STABILITY, stacks: 3, duration: 4 }]
  },
  triggers: [
    onTriggerPoint(virtueActivated, {
      when: (_runtime, { virtue }: VirtueActivation) => virtue === 'courage',
      run: (runtime: GuardianRuntime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE, boonKey(BOON.STABILITY), true)
    })
  ]
});

/** Consecrations last longer; their repeated pulses continue through the added lifetime on their own interval. */
export const masterOfConsecrations = defineTrait({
  name: 'Master of Consecrations',
  id: GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS,
  balance: { durationMultiplier: 1.4 },
  // Field duration is multiplied by Core after its weapon-field selection; see guardian core hooks.
  hooks: {
    modifyEffects: (runtime: MechanicQueriesOf<GuardianRuntime>, cast, effects) =>
      masterOfConsecrationsEffects(runtime, cast.skill, effects)
  }
});

/** Owns Power of the Virtuous tuning and behavior at its existing mechanic boundaries. */
export const powerOfTheVirtuous = defineTrait({
  name: 'Power of the Virtuous',
  id: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS,
  balance: {
    attributeConversion: 0.07,
    rechargeMultiplier: 0.85
  },
  attributes: traitAttributeEffects(GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ]),
  rechargeRules: [
    {
      when: (_runtime, skill) =>
        Boolean(skill.categories?.includes('Virtue')) && /^Profession_[1-3]$/.test(String(skill.slot || '')),
      multiplier: { profile: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Unscathed Contender tuning and behavior at its existing mechanic boundaries. */
export const unscathedContender = defineTrait({
  name: 'Unscathed Contender',
  id: GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05, damageIncrease: 0.05 },
  modifierRules: [
    {
      order: -12,
      id: 'guardian.unscathed-contender-health',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // The assumed above-90% health bonus multiplies damage; the Aegis bonus stays additive.
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER, 'damageMultiplier')
    },
    {
      order: -11,
      id: 'guardian.unscathed-contender-aegis',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER, 'damageIncrease'),
      when: (context) => guardianBoonActive(context, boonKey(BOON.AEGIS))
    }
  ]
});

/** Owns Glacial Heart tuning and behavior at its existing mechanic boundaries. */
export const glacialHeart = defineTrait({
  name: 'Glacial Heart',
  id: GUARDIAN_TRAIT_IDS.GLACIAL_HEART,
  // Hammer 2 resolves to the selected variant, so saved rotations survive trait edits.
  hooks: {
    modifySkillId: traitSkillReplacement(GUARDIAN_TRAIT_IDS.GLACIAL_HEART, [[ID.MIGHTY_BLOW, ID.GLACIAL_BLOW]])
  }
});

export const battlePresence = defineTrait({ name: 'Battle Presence', id: GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE });

/** Committed activation boons sample live attributes and retain their selected component and party ownership. */
function virtueBuff(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  trait: number,
  kind: string,
  party = false
): void {
  // Select the virtue's named component without rebuilding the profile's boon or buff packet.
  emitTraitProfile(runtime, trait, trait, undefined, {
    effect: { type: kind === 'guardian-inspiring-virtue' ? 'buff' : 'boon', name: kind },
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    attribution: {
      source: 'Trait',
      sourceId: trait,
      actorType: ACTOR.PLAYER,
      audience: { recipients: party ? RECIPIENT.PARTY : RECIPIENT.SELF }
    },
    transform: (event) => ({ ...event, kind })
  });
}

/** Only selected consecrations last longer; every other skill keeps its authored lifetime. */
function consecrationMultiplier(runtime: MechanicQueriesOf<GuardianRuntime>, skill: Skill): number {
  return skill.id === ID.PURGING_FLAMES && hasTrait(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS)
    ? balanceNumberFromContext(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS, 'durationMultiplier')
    : 1;
}

/** Extend Purging Flames before Writ's separate symbol-field adjustment; Core composes both after field selection. */
export function masterOfConsecrationsFields(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  cast: RuntimeCast<GuardianSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  const multiplier = consecrationMultiplier(runtime, cast.skill);
  return multiplier === 1
    ? fields
    : fields?.map((field) => ({ ...field, duration: Number(field.duration) * multiplier }));
}

/** The added field lifetime holds whole extra pulses of each repeated consecration payload. */
function masterOfConsecrationsEffects(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: Skill,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const multiplier = consecrationMultiplier(runtime, skill);
  const duration = Number(skill.comboFields?.[0]?.duration ?? 0);
  return multiplier > 1 ? extendPeriodicEffects(effects, Math.round(duration * (multiplier - 1) * 1000)) : effects;
}
