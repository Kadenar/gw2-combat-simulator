import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { durationStackingBoonCapSeconds, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  guardianBuffApplied,
  guardianCastCompleted,
  type GuardianBuffApplication,
  type GuardianCastCompletion
} from '#gw2/professions/guardian/core/mechanics/combat-boundaries.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { justiceBlinding, type JusticeBlinding } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
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
  },
  triggers: [
    onTriggerPoint(guardianCastCompleted, {
      when: (_runtime, { cast }: GuardianCastCompletion) => cast.skill.type === 'Heal',
      run: grantHealersResolution
    })
  ]
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
  triggers: [
    onTriggerPoint(guardianBuffApplied, {
      when: (_runtime, { cause }: GuardianBuffApplication) =>
        cause.kind === 'resolution' && cause.resolvedAudience?.includesSelf === true,
      run: (runtime: Runtime, { cause }: GuardianBuffApplication) => startRighteousInstincts(runtime, cause)
    })
  ],
  lifetime: { tasks: { [RESOLUTION_EXPIRY]: expireRighteousResolution, [MIGHT]: pulseRighteousMight } }
});

/** Owns Right-Hand Strength's live tuning and trait behavior. */
export const rightHandStrength = defineTrait({
  id: TRAIT.RIGHT_HAND_STRENGTH,
  name: 'Right-Hand Strength',
  balance: { attributeBonus: 80 },
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const rightHandStrengthProfile = requireBalanceProfileFromContext(profileContext, TRAIT.RIGHT_HAND_STRENGTH);
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
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
      order: -9,
      id: 'guardian.radiant-power-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_POWER), 'criticalChance'),
      when: (context) => targetConditionActive(context, 'Burning')
    }
  ],
  attributes: traitAttributeEffects(TRAIT.RADIANT_POWER, [
    { kind: 'flat', to: 'Ferocity', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Radiant Fire's live tuning and trait behavior. */
export const radiantFire = defineTrait({
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Torch',
      multiplier: { profile: TRAIT.RADIANT_FIRE, field: 'rechargeMultiplier' }
    }
  ],

  hooks: { maximumAmmo: radiantFireMaximumAmmo },

  id: TRAIT.RADIANT_FIRE,
  name: 'Radiant Fire',
  balance: {
    conditionDurationBonus: 0.2,
    rechargeMultiplier: 0.8,
    durationMultiplier: 1.5,
    maximumStacks: 2
  },
  attributes: ({ balanceContext }) => ({
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
    conditionDamageMultiplier: 1.1,
    durationMultiplier: 1.2
  },
  modifierRules: [
    {
      order: -2,
      id: 'guardian.amplified-wrath-damage',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.AMPLIFIED_WRATH),
          'conditionDamageMultiplier'
        ),
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
  },
  triggers: [onTriggerPoint(justiceBlinding, { run: blindFromJustice })]
});

/** Owns Retribution's live tuning and trait behavior. */
export const retribution = defineTrait({
  id: TRAIT.RETRIBUTION,
  name: 'Retribution',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.1 },
  modifierRules: [
    {
      order: -7,
      id: 'guardian.retribution',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RETRIBUTION), 'damageIncrease'),
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
      cooldown: 'profile',
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
  emitTraitProfile(runtime, TRAIT.RIGHTEOUS_INSTINCTS, TRAIT.RIGHTEOUS_INSTINCTS, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'boon', name: 'might' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.RIGHTEOUS_INSTINCTS,
      actorType: 'player',
      skillId: TRAIT.RIGHTEOUS_INSTINCTS,
      skillName: profile.name,
      activationId: event.activationId
    },
    preserveName: true,
    transform: (packet) => ({ ...packet, causalOrder: event.causalOrder ?? event.eventOrder })
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
function startRighteousInstincts(runtime: Runtime, event: Gw2ResolverEvent): void {
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

/** A committed heal claims Resolution's interval only when its selected boon can emit. */
function grantHealersResolution(runtime: Runtime, { cast }: GuardianCastCompletion): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEALERS_RESOLUTION);
  // A removed boon leaves this heal's claim ready.
  if (
    !requireEffect(profile, 'boon', 'resolution') ||
    !runtime.procs.claim(TRAIT.HEALERS_RESOLUTION, 'guardian.core.healersResolution', runtime.time)
  )
    return;
  const cause = guardianCastCause(runtime, cast);
  emitTraitProfile(runtime, TRAIT.HEALERS_RESOLUTION, TRAIT.HEALERS_RESOLUTION, cause, {
    at: runtime.time,
    effect: { type: 'boon', name: 'resolution' },
    attribution: { source: cause.source, actorType: cause.actorType }
  });
}

/** Admit the companion aura before Blind; removing Blind does not remove the independent aura reward. */
function blindFromJustice(runtime: Runtime, { cause: event, skill, auraTask }: JusticeBlinding): void {
  // The independent aura is admitted before Blind; removal of the latter never cancels the former.
  runtime.schedule(auraTask, event.at, event, undefined, -10);
  emitTraitProfile(runtime, TRAIT.JUSTICE_IS_BLIND, TRAIT.JUSTICE_IS_BLIND, event, {
    at: event.at,
    effect: { type: 'condition', name: 'Blind' },
    attribution: {
      source: event.source,
      skillId: TRAIT.JUSTICE_IS_BLIND,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Justice is Blind',
      triggeredBy: skill.name,
      offTarget: event.offTarget
    },
    transform: (packet) => ({ ...packet, causalOrder: event.causalOrder ?? event.eventOrder, name: event.name })
  });
}

/** Selected Radiant Fire raises Zealot's Flame capacity without reducing a larger authored capacity. */
function radiantFireMaximumAmmo(context: MaximumAmmoContext<object>, skill: Skill, maximum: number): number {
  return skill.id === ID.ZEALOTS_FLAME && context.hasTrait(TRAIT.RADIANT_FIRE)
    ? Math.max(maximum, balanceProfileNumber(context.requireBalanceProfile(TRAIT.RADIANT_FIRE), 'maximumStacks'))
    : maximum;
}
