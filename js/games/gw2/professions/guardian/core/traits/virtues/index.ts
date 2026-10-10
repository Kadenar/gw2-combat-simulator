import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { virtueActivated, type VirtueActivation } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianResolutionMultiplier } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_TRAIT_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Owns Permeating Wrath tuning and behavior at its existing mechanic boundaries. */
export const permeatingWrath = defineTrait({
  id: GUARDIAN_TRAIT_IDS.PERMEATING_WRATH,
  name: 'Permeating Wrath',
  balance: { threshold: 3 }
});

/** Owns Inspired Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiredVirtue = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
  // Each virtue grants its own party boon.
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: Runtime, { cast, virtue }: VirtueActivation) =>
        virtueBuff(
          runtime,
          cast,
          GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
          virtue === 'justice' ? 'might' : virtue === 'resolve' ? 'regeneration' : 'protection',
          true
        )
    })
  ],
  name: 'Inspired Virtue',
  balance: {
    damagePerBoon: 0.005,
    maximumBoons: GW2_STANDARD_BOONS.length,
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 3, duration: 5 },
      { type: 'boon', name: 'regeneration', boon: 'regeneration', stacks: 1, duration: 5 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 5 }
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
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE),
            'maximumBoons'
          ),
          countActiveBoons(context, { actor: 'player' }, (boon) => guardianBoonActive(context, boon))
        ) *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE),
            'damagePerBoon'
          )
    }
  ]
});

/** Owns Virtue of Resolution tuning and behavior at its existing mechanic boundaries. */
export const virtueOfResolution = defineTrait({
  hooks: {
    /** Resolution samples this multiplier once when the shared service applies a boon. */
    boonDuration(runtime, event, _baseDuration, scaledDuration) {
      return event.kind === 'resolution' ? scaledDuration * guardianResolutionMultiplier(runtime) : scaledDuration;
    }
  },

  id: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: Runtime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION, 'resolution')
    })
  ],
  name: 'Virtue of Resolution',
  balance: {
    durationMultiplier: 1.25,
    effects: [{ type: 'boon', name: 'resolution', boon: 'resolution', stacks: 1, duration: 3 }]
  }
});

/** Owns Inspiring Virtue tuning and behavior at its existing mechanic boundaries. */
export const inspiringVirtue = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
  triggers: [
    onTriggerPoint(virtueActivated, {
      run: (runtime: Runtime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE, 'guardian-inspiring-virtue')
    })
  ],
  name: 'Inspiring Virtue',
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
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE),
          'damageIncrease'
        ),
      when: (context) => buffActive(context, 'guardian-inspiring-virtue')
    }
  ]
});

/** Owns Indomitable Courage tuning and behavior at its existing mechanic boundaries. */
export const indomitableCourage = defineTrait({
  id: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
  triggers: [
    onTriggerPoint(virtueActivated, {
      when: (_runtime, { virtue }: VirtueActivation) => virtue === 'courage',
      run: (runtime: Runtime, { cast }: VirtueActivation) =>
        virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE, 'stability')
    })
  ],
  name: 'Indomitable Courage',
  balance: {
    pulseInterval: 30,
    effects: [{ type: 'boon', name: 'stability', boon: 'stability', stacks: 3, duration: 4 }]
  }
});

/** Owns Master of Consecrations tuning and behavior at its existing mechanic boundaries. */
export const masterOfConsecrations = defineTrait({
  id: GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS,
  name: 'Master of Consecrations',
  balance: {
    // Extra Purging Flames pulses extend the authored skill rather than creating a standalone proc.
    damagePreviewAttribution: 'skill',
    durationMultiplier: 1.4,
    // Extend Purging Flames after its six base pulses, with independent cast-start timelines for each effect.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        ticks: [6320, 7320].map((atMs) => ({ atMs, coefficient: 0.2 })),
        actorType: 'player'
      },
      {
        type: 'condition',
        name: 'Burning',
        ticks: [6320, 7320].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 2 })),
        actorType: 'player'
      }
    ])
  }
});

/** Owns Power of the Virtuous tuning and behavior at its existing mechanic boundaries. */
export const powerOfTheVirtuous = defineTrait({
  rechargeRules: [
    {
      when: (_runtime, skill) =>
        Boolean(skill.categories?.includes('Virtue')) && /^Profession_[1-3]$/.test(String(skill.slot || '')),
      multiplier: { profile: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, field: 'rechargeMultiplier' }
    }
  ],

  id: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS,
  name: 'Power of the Virtuous',
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
  ])
});

/** Owns Unscathed Contender tuning and behavior at its existing mechanic boundaries. */
export const unscathedContender = defineTrait({
  id: GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER,
  name: 'Unscathed Contender',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05, damageIncrease: 0.05 },
  modifierRules: [
    {
      order: -12,
      id: 'guardian.unscathed-contender-health',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // The assumed above-90% health bonus multiplies damage; the Aegis bonus stays additive.
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER),
          'damageMultiplier'
        )
    },
    {
      order: -11,
      id: 'guardian.unscathed-contender-aegis',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER),
          'damageIncrease'
        ),
      when: (context) => guardianBoonActive(context, 'aegis')
    }
  ]
});

/** Owns Glacial Heart tuning and behavior at its existing mechanic boundaries. */
export const glacialHeart = defineTrait({
  hooks: { availability: (runtime, skill) => glacialHeartAvailability(runtime, skill) ?? { ready: true } },
  id: GUARDIAN_TRAIT_IDS.GLACIAL_HEART,
  name: 'Glacial Heart'
});

export const battlePresence = defineTrait({ id: GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE, name: 'Battle Presence' });

/** Committed activation boons sample live attributes and retain their selected component and party ownership. */
function virtueBuff(
  runtime: Runtime,
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
      actorType: 'player',
      audience: { recipients: party ? 'party' : 'self' }
    },
    transform: (event) => ({ ...event, kind })
  });
}

/** Extend Purging Flames before Writ's separate symbol-field adjustment; Core composes both after field selection. */
export function masterOfConsecrationsFields(
  runtime: MechanicQueriesOf<Runtime>,
  cast: RuntimeCast<GuardianSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (cast.skill.id !== ID.PURGING_FLAMES || !hasTrait(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS))
    return fields;
  const multiplier = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS),
    'durationMultiplier'
  );
  return fields?.map((field) => ({ ...field, duration: Number(field.duration) * multiplier }));
}

/** Resolve hammer replacement before the Core weapon-flip availability checks. */
function glacialHeartAvailability(runtime: MechanicQueriesOf<Runtime>, skill: Skill) {
  const glacial = hasTrait(runtime, GUARDIAN_TRAIT_IDS.GLACIAL_HEART);
  if (skill.id === ID.MIGHTY_BLOW && glacial)
    return denySkillCast(
      skill,
      'guardian.trait-replacement',
      'Glacial Blow replaces it while Glacial Heart is selected.'
    );
  if (skill.id === ID.GLACIAL_BLOW && !glacial)
    return denySkillCast(skill, 'guardian.trait-replacement', 'requires the Glacial Heart trait.');
  return null;
}
