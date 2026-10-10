import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  burstFirstHit,
  coreInitialized,
  focusReset,
  soldierFocusApplied,
  weaponSwapped
} from '#gw2/professions/warrior/core/mechanics/combat.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { warriorActiveBoonCount } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const EMPOWER_PULSE = 'warrior.empower-allies-pulse';

/** Convert Power to Healing Power once, preserving the build's existing conversion pool. */
export const vigorousShouts = defineTrait({
  id: TRAIT.VIGOROUS_SHOUTS,
  name: 'Vigorous Shouts',
  balance: { attributeConversion: 0.13 },
  buildAttributes: traitAttributeEffects(TRAIT.VIGOROUS_SHOUTS, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Healing Power',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ]),
  modifierRules: [
    {
      id: 'warrior.vigorous-shouts-healing-power',
      target: MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      operation: 'add',
      amount: (context) =>
        (context.config?.stats?.power || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VIGOROUS_SHOUTS), 'attributeConversion'),
      when: (context) => !professionStaticRulesApplied(context.config)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const legSpecialist = defineTrait({
  id: TRAIT.LEG_SPECIALIST,
  name: 'Leg Specialist',
  balance: {
    damageMultiplier: 1.05,
    effects: [{ name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.leg-specialist',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LEG_SPECIALIST), 'damageMultiplier'),
      order: 91,
      when: (context) =>
        ['Crippled', 'Chilled', 'Immobilized'].some((condition) => targetConditionActive(context, condition))
    }
  ],
  triggers: [
    {
      order: 8,

      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Crippled',
      emit: TRAIT.LEG_SPECIALIST,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const marchingOrders = defineTrait({
  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => soldierFocusBurst(runtime, input.event)
    })
  ],
  id: TRAIT.MARCHING_ORDERS,
  name: 'Marching Orders',
  balance: {
    internalCooldown: 10,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 3, duration: 15 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const soldiersComfort = defineTrait({
  triggers: [
    onTriggerPoint(soldierFocusApplied, {
      run: (runtime, input: TriggerPointInput<typeof soldierFocusApplied>) => soldiersComfortFocus(runtime, input.event)
    })
  ],
  id: TRAIT.SOLDIERS_COMFORT,
  name: "Soldier's Comfort",
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 4 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const martialCadence = defineTrait({
  triggers: [
    onTriggerPoint(soldierFocusApplied, {
      run: (runtime, input: TriggerPointInput<typeof soldierFocusApplied>) => martialCadenceFocus(runtime, input.event)
    }),
    onTriggerPoint(focusReset, { run: (runtime) => resetSoldierFocus(runtime) }),
    onTriggerPoint(weaponSwapped, { run: (runtime) => resetSoldierFocus(runtime) })
  ],
  id: TRAIT.MARTIAL_CADENCE,
  name: 'Martial Cadence',
  balance: {
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const empowerAllies = defineTrait({
  triggers: [onTriggerPoint(coreInitialized, { run: (runtime) => initializeEmpowerAllies(runtime) })],
  id: TRAIT.EMPOWER_ALLIES,
  name: 'Empower Allies',
  balance: {
    pulseInterval: 10,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 10 }]
  },
  lifetime: { tasks: { [EMPOWER_PULSE]: empowerPulse } }
});

/** Owns this trait's tuning and selected contributions. */
export const roaringReveille = defineTrait({
  id: TRAIT.ROARING_REVEILLE,
  name: 'Roaring Reveille',
  balance: {
    attributeBonus: 120
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.ROARING_REVEILLE),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const empowered = defineTrait({
  id: TRAIT.EMPOWERED,
  name: 'Empowered',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damagePerBoon: 0.01, maximumBoons: GW2_STANDARD_BOONS.length },
  modifierRules: [
    {
      id: 'warrior.empowered',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Count unique boons only up to the selected balance cap.

      factor: (context) =>
        1 +
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPOWERED), 'maximumBoons'),
          warriorActiveBoonCount(context)
        ) *
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPOWERED), 'damagePerBoon'),
      order: 90
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const warriorsCunning = defineTrait({
  id: TRAIT.WARRIORS_CUNNING,
  name: "Warrior's Cunning",
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.25, threshold: 0.8 },
  modifierRules: [
    {
      id: 'warrior.warriors-cunning',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WARRIORS_CUNNING), 'damageMultiplier'),
      order: 92,
      when: (context) =>
        targetHealthFraction(context) >
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WARRIORS_CUNNING), 'threshold')
    }
  ]
});

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

// Resolve Tactics-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorTacticsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    const roaringReveilleProfile = requireBalanceProfileFromContext(context, TRAIT.ROARING_REVEILLE);
    result.concentration += balanceProfileNumber(roaringReveilleProfile, 'attributeBonus');
  }
}

export function empowerPulse(runtime: WarriorRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const might = requireEffect(profile, 'boon', 'might');
  if (!hasTrait(runtime, TRAIT.EMPOWER_ALLIES) || interval <= 0 || !might) return;
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
    emitTraitProfile(
      runtime,
      TRAIT.EMPOWER_ALLIES,
      TRAIT.EMPOWER_ALLIES,
      { sourceId: TRAIT.EMPOWER_ALLIES, actorType: 'effect' },
      {
        attribution: { source: 'Trait', sourceId: TRAIT.EMPOWER_ALLIES, actorType: 'effect' },
        transform: (packet) => ({
          ...packet,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          priority: 0,
          audience: { recipients: 'party' }
        }),
        effects: (candidate) => candidate === might
      }
    );
  }

  runtime.schedule(EMPOWER_PULSE, canonicalTime(runtime.time + interval), null, undefined, -210);
}

/** Apply line-owned rewards at the shared reaction boundary. */
function soldierFocusBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (runtime.procs.claim(TRAIT.MARCHING_ORDERS, 'warrior.core.soldierFocus', runtime.time)) {
    // All Soldier's Focus rewards share the claim; Martial Cadence still owns its explicit swap resets.
    const audience = { recipients: 'party' as const };
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.MARCHING_ORDERS);
      emitTraitProfile(runtime, TRAIT.MARCHING_ORDERS, TRAIT.MARCHING_ORDERS, event, {
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.MARCHING_ORDERS,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          priority: 5,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          audience
        }),
        effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
      });
    }

    runtime.fireTrigger(soldierFocusApplied, { event });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function resetSoldierFocus(runtime: WarriorRuntime): void {
  runtime.procs.setDeadline('warrior.core.soldierFocus', runtime.time);
}

/** Arm the first selected pulse after the Core pool is initialized. */
function initializeEmpowerAllies(runtime: WarriorRuntime): void {
  runtime.schedule(EMPOWER_PULSE, 0, null, undefined, -210);
}

/** Grant the selected follow-up only after Focus consumed its shared proc. */
function soldiersComfortFocus(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  const audience = { recipients: 'party' as const };
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.SOLDIERS_COMFORT);
    emitTraitProfile(runtime, TRAIT.SOLDIERS_COMFORT, TRAIT.SOLDIERS_COMFORT, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SOLDIERS_COMFORT,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks: 1 * Number(packet.stacks),
        audience
      }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}

/** Grant the selected follow-up only after Focus consumed its shared proc. */
function martialCadenceFocus(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  const audience = { recipients: 'party' as const };
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.MARTIAL_CADENCE);
    emitTraitProfile(runtime, TRAIT.MARTIAL_CADENCE, TRAIT.MARTIAL_CADENCE, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.MARTIAL_CADENCE,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        priority: 5,
        name: traitProfile.name,
        stacks: 1 * Number(packet.stacks),
        audience
      }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}
