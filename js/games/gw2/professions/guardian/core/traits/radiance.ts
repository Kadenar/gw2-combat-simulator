import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { durationStackingBoonCapSeconds, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  activeWeapon,
  guardianBoonActive,
  isOneHandedWeapon
} from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

const MIGHT = 'guardian.righteous-might';

const RESOLUTION_EXPIRY = 'guardian.resolution-expiry';

/** Owns Healer's Resolution's live tuning and trait behavior. */
export const healersResolution = defineTrait({
  id: TRAIT.HEALERS_RESOLUTION,
  name: "Healer's Resolution",
  balance: {
    internalCooldown: 20,
    effects: [{ type: 'boon', name: 'resolution', boon: 'resolution', duration: 8, stacks: 1 }]
  }
});

/** Owns Righteous Instincts's live tuning and trait behavior. */
export const righteousInstincts = defineTrait({
  id: TRAIT.RIGHTEOUS_INSTINCTS,
  name: 'Righteous Instincts',
  balance: {
    criticalChance: 0.25,
    pulseInterval: 1,
    effects: [{ type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      order: -8,
      id: 'guardian.righteous-instincts',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RIGHTEOUS_INSTINCTS), 'criticalChance'),
      when: (context) => guardianBoonActive(context, 'resolution')
    }
  ],
  // Hoisted handlers keep trait declarations first without changing task priorities or initialization order.
  hooks: { tasks: { [RESOLUTION_EXPIRY]: expireRighteousResolution, [MIGHT]: pulseRighteousMight } }
});

/** Owns Right-Hand Strength's live tuning and trait behavior. */
export const rightHandStrength = defineTrait({
  id: TRAIT.RIGHT_HAND_STRENGTH,
  name: 'Right-Hand Strength',
  balance: { attributeBonus: 80 },
  modifierRules: [
    {
      order: -19,
      id: 'guardian.right-hand-strength-precision',
      label: 'Right-Hand Strength',
      target: MODIFIER_TARGET.ATTRIBUTE_PRECISION,
      operation: 'add',
      amount: (context) =>
        attributeProvenance(context.config).professionStaticRulesApplied
          ? 0
          : balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RIGHT_HAND_STRENGTH), 'attributeBonus')
    },
    {
      order: -18,
      id: 'guardian.right-hand-strength-power',
      label: 'Right-Hand Strength',
      target: MODIFIER_TARGET.ATTRIBUTE_POWER,
      operation: 'add',
      amount: (context) => {
        const provenance = attributeProvenance(context.config);
        const currentWeapon = activeWeapon(context);
        const rightHandStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.RIGHT_HAND_STRENGTH);
        return provenance.professionStaticRulesApplied
          ? (Number(isOneHandedWeapon(currentWeapon)) - Number(isOneHandedWeapon(provenance.calculatedPrimaryWeapon))) *
              balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus')
          : Number(isOneHandedWeapon(currentWeapon)) * balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus');
      }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const rightHandStrengthProfile = requireBalanceProfileFromContext(profileContext, TRAIT.RIGHT_HAND_STRENGTH);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const mainHand = weapons[0] || '';
    const oneHandedMainHand =
      mainHand !== '' && !['Greatsword', 'Hammer', 'Longbow', 'Spear', 'Staff'].includes(mainHand);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Precision',
          amount: balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus'),
          feedsConversions: false
        },
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: oneHandedMainHand
        }
      ]
    };
  }
});

/** Owns Radiant Power's live tuning and trait behavior. */
export const radiantPower = defineTrait({
  id: TRAIT.RADIANT_POWER,
  name: 'Radiant Power',
  balance: {
    criticalChance: 0.1,
    attributeBonus: 150
  },
  modifierRules: [
    {
      order: -17,
      id: 'guardian.radiant-power-ferocity',
      label: 'Radiant Power',
      target: MODIFIER_TARGET.ATTRIBUTE_FEROCITY,
      operation: 'add',
      amount: (context) =>
        attributeProvenance(context.config).professionStaticRulesApplied
          ? 0
          : balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_POWER), 'attributeBonus')
    },
    {
      order: -9,
      id: 'guardian.radiant-power-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_POWER), 'criticalChance'),
      when: (context) => targetConditionActive(context, 'Burning')
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.RADIANT_POWER, [
    { kind: 'flat', to: 'Ferocity', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Radiant Fire's live tuning and trait behavior. */
export const radiantFire = defineTrait({
  id: TRAIT.RADIANT_FIRE,
  name: 'Radiant Fire',
  balance: {
    conditionDurationBonus: 0.2,
    rechargeMultiplier: 0.8,
    durationMultiplier: 1.5,
    maximumStacks: 2
  },
  modifierRules: [
    {
      order: -1,
      id: 'guardian.radiant-fire-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE), 'conditionDurationBonus'),
      // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
      when: (context) =>
        context.condition === 'Burning' && !attributeProvenance(context.config).professionStaticRulesApplied
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.RADIANT_FIRE),
          'conditionDurationBonus'
        )
    }
  })
});

/** Owns Amplified Wrath's live tuning and trait behavior. */
export const amplifiedWrath = defineTrait({
  id: TRAIT.AMPLIFIED_WRATH,
  name: 'Amplified Wrath',
  balance: {
    durationMultiplier: 1.2
  },
  modifierRules: [
    {
      order: -2,
      id: 'guardian.amplified-wrath-damage',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => context.condition === 'Burning'
    }
  ]
});

/** Owns Perfect Inscriptions's live tuning and trait behavior. */
export const perfectInscriptions = defineTrait({
  id: TRAIT.PERFECT_INSCRIPTIONS,
  name: 'Perfect Inscriptions',
  balance: {
    attributeMultiplier: 1.2
  }
});

/** Owns Justice is Blind's live tuning and trait behavior. */
export const justiceIsBlind = defineTrait({
  id: TRAIT.JUSTICE_IS_BLIND,
  name: 'Justice is Blind',
  balance: {
    effects: [
      {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 3,
        name: 'Blind'
      }
    ]
  }
});

/** Owns Retribution's live tuning and trait behavior. */
export const retribution = defineTrait({
  id: TRAIT.RETRIBUTION,
  name: 'Retribution',
  modifierRules: [
    {
      order: -7,
      id: 'guardian.retribution',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => guardianBoonActive(context, 'resolution')
    }
  ]
});

/** Player strikes grant Fury only while the target has enough live or assumed Burning stacks. */
export const innerFire = defineTrait({
  id: TRAIT.INNER_FIRE,
  name: 'Inner Fire',
  balance: {
    threshold: 3,
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'fury', boon: 'fury', duration: 8, stacks: 1 }]
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.INNER_FIRE,
      icd: 'profile',
      when: (runtime, event, details) =>
        event.actorType === 'player' &&
        (details.hitContext?.damage ?? 0) > 0 &&
        runtime.combat.targetConditionStacks('Burning', event.at) >=
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.INNER_FIRE), 'threshold')
    }
  ]
});

/** Resolution readiness follows the accepted self-boon pool, including its cap and extension records. */
function resolutionDeadline(runtime: Runtime): number {
  const remaining = remainingDurationStackSeconds(runtime.combat.boonApplications('resolution'), runtime.time, {
    includes: (application) => application.resolvedAudience.includesSelf,
    maximum: durationStackingBoonCapSeconds('resolution'),
    ordered: true
  });
  return remaining > 0 ? canonicalTime(runtime.time + remaining) : 0;
}

/** Grant the selected Might component without moving its emission outside the Resolution cadence. */
function righteousMight(runtime: Runtime, event: Gw2ResolverEvent): boolean {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.RIGHTEOUS_INSTINCTS);
  const effect = requireEffect(profile, 'boon', 'might');
  if (!effect) return false;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.RIGHTEOUS_INSTINCTS,
      actorType: 'player',
      skillId: TRAIT.RIGHTEOUS_INSTINCTS,
      skillName: profile.name,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      kind: 'might',
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    }
  });
  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: profile.name,
        at: runtime.time,
        sourceSkill: 'Resolution',
        detail: 'Resolution active',
        icon: guardianTraitIcon(TRAIT.RIGHTEOUS_INSTINCTS)
      }
    });
  }

  return true;
}

/** A new self Resolution window starts one cadence; additional applications extend its pool without duplicating ticks. */
export function reactToRighteousInstinctsBuff(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (
    event.kind !== 'resolution' ||
    event.resolvedAudience?.includesSelf !== true ||
    !hasTrait(runtime, TRAIT.RIGHTEOUS_INSTINCTS)
  )
    return;
  const state = runtime.profession.core;
  const active = state.resolutionUntil > runtime.time;
  state.resolutionUntil = resolutionDeadline(runtime);
  if (!(state.resolutionUntil > runtime.time)) return;
  runtime.schedule(RESOLUTION_EXPIRY, state.resolutionUntil, state.resolutionUntil, undefined, -220);
  if (active) return;
  state.righteousInstinctsGeneration++;
  if (!righteousMight(runtime, event)) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.RIGHTEOUS_INSTINCTS),
    'pulseInterval'
  );
  if (interval > 0)
    runtime.schedule(
      MIGHT,
      canonicalTime(runtime.time + interval),
      { generation: state.righteousInstinctsGeneration, event },
      undefined,
      -10
    );
}

/** Refresh the live Resolution deadline before same-time Might pulses. */
function expireRighteousResolution(runtime: Runtime, deadline: unknown): void {
  const state = runtime.profession.core;
  if (state.resolutionUntil !== deadline) return;
  state.resolutionUntil = resolutionDeadline(runtime);
  if (state.resolutionUntil > runtime.time)
    runtime.schedule(RESOLUTION_EXPIRY, state.resolutionUntil, state.resolutionUntil, undefined, -220);
}

/** Continue one Might cadence while its generation and Resolution window remain live. */
function pulseRighteousMight(runtime: Runtime, data: unknown): void {
  const { generation, event } = data as { generation: number; event: Gw2ResolverEvent };
  const state = runtime.profession.core;
  if (generation !== state.righteousInstinctsGeneration) return;
  state.resolutionUntil = resolutionDeadline(runtime);
  if (!(state.resolutionUntil > runtime.time) || !righteousMight(runtime, event)) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.RIGHTEOUS_INSTINCTS),
    'pulseInterval'
  );
  if (interval > 0) runtime.schedule(MIGHT, canonicalTime(runtime.time + interval), data, undefined, -10);
}
