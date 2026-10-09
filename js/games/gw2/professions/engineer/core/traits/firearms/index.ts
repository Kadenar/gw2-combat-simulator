import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect,
  procChanceFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { heavyMetalBonus } from '#gw2/professions/engineer/core/traits/firearms/modifiers.js';
import { activeBoonStacks, targetConditionCount } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  type EngineerBuild,
  type EngineerResolverContext,
  type EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { emitIncendiaryPowder, emitSerratedSteel } from '#gw2/professions/engineer/core/traits/firearms/emissions.js';
/** Owns Serrated Steel tuning and behavior at its established runtime and build boundaries. */
export const serratedSteel = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: {
    reactions: {
      'damage.resolved': criticalProcHandler({
        id: 'engineer.core.serrated-steel',
        actorTypes: ['player', 'effect', 'unknown'],
        when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.SERRATED_STEEL),
        chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
        randomStream: 'engineer.serrated-steel',
        handler(context, event, _details, application) {
          emitSerratedSteel(context, event, application.quantity, { actorType: 'effect', ownerActorType: 'player' });
        }
      })
    }
  },
  id: TRAIT.SERRATED_STEEL,
  name: 'Serrated Steel',
  balance: {
    procRate: {
      id: 'engineer.serrated-steel',
      traitId: TRAIT.SERRATED_STEEL,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    durationMultiplier: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      order: -7,
      id: 'engineer.serrated-steel-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',

      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SERRATED_STEEL), 'durationMultiplier'),
      // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
      when: (context) => context.condition === 'Bleeding' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SERRATED_STEEL),
          'durationMultiplier'
        )
    }
  })
});

/** Owns No Scope tuning and behavior at its established runtime and build boundaries. */
export const noScope = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: {
    reactions: {
      'damage.resolved': criticalProcHandler({
        id: 'engineer.core.no-scope',
        actorTypes: ['player'],
        when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.NO_SCOPE),
        internalCooldown: {
          duration: (context) =>
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE), 'internalCooldown'),
          readyAt: (context) => context.procs.deadline('noScope') || 0,
          setReadyAt: (context, readyAt) => {
            context.procs.setDeadline('noScope', readyAt);
          }
        },
        handler: grantNoScope
      })
    }
  },
  id: TRAIT.NO_SCOPE,
  name: 'No Scope',
  balance: {
    internalCooldown: 8,
    attributeBonus: 150,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  },
  buildAttributes: (_common, { balanceContext: profileContext, build }) => {
    const engineerBuild = build as EngineerBuild;
    const noScopeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.NO_SCOPE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(noScopeProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions?.fury !== false
        }
      ]
    };
  }
});

/** Owns Incendiary Powder tuning and behavior at its established runtime and build boundaries. */
export const incendiaryPowder = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: {
    reactions: {
      'damage.resolved': criticalProcHandler({
        id: 'engineer.core.incendiary-powder-player',
        actorTypes: ['player'],
        when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.INCENDIARY_POWDER),
        internalCooldown: {
          duration: (context) =>
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER),
              'internalCooldown'
            ),
          readyAt: (context) => context.procs.deadline('incendiaryPowder.player') || 0,
          setReadyAt: (context, readyAt) => {
            context.procs.setDeadline('incendiaryPowder.player', readyAt);
          }
        },
        handler(context, event) {
          emitIncendiaryPowder(context, event, { actorType: 'effect', ownerActorType: 'player' });
        }
      })
    }
  },
  id: TRAIT.INCENDIARY_POWDER,
  name: 'Incendiary Powder',
  balance: {
    internalCooldown: 10,
    durationMultiplier: 0.33,
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      order: -6,
      id: 'engineer.incendiary-powder-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',

      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'durationMultiplier'),
      when: (context) => context.condition === 'Burning' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.INCENDIARY_POWDER),
          'durationMultiplier'
        )
    }
  })
});

/** Owns Thermal Vision tuning and behavior at its established runtime and build boundaries. */
export const thermalVision = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'condition.applied': applyThermalVision } },
  id: TRAIT.THERMAL_VISION,
  name: 'Thermal Vision',
  balance: {
    attributeBonus: 150,
    effects: [{ name: 'thermal-vision', type: 'buff', kind: 'thermal-vision', stacks: 1, duration: 4 }]
  },
  modifierRules: [
    {
      order: -8,
      // Accepted Burning-triggered buff windows own the modifier lifetime.
      id: 'engineer.thermal-vision-damage',
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) => buffActive(context, 'thermal-vision')
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.THERMAL_VISION, [
    { kind: 'flat', to: 'Expertise', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Sanguine Array tuning and behavior at its established runtime and build boundaries. */
export const sanguineArray = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'condition.applied': applySanguineArray } },
  id: TRAIT.SANGUINE_ARRAY,
  name: 'Sanguine Array',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 4 }]
  }
});

/** Owns Hematic Focus tuning and behavior at its established runtime and build boundaries. */
export const hematicFocus = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'condition.applied': applyHematicFocus } },
  id: TRAIT.HEMATIC_FOCUS,
  name: 'Hematic Focus',
  balance: {
    criticalChance: 0.15,
    internalCooldown: 8,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      order: -5,
      id: 'engineer.hematic-focus',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, 'fury', 1) > 0
    }
  ]
});

/** Owns Chemical Rounds tuning and behavior at its established runtime and build boundaries. */
export const chemicalRounds = defineTrait({
  id: TRAIT.CHEMICAL_ROUNDS,
  name: 'Chemical Rounds',
  balance: {
    conditionDurationMultiplier: 4 / 3,
    attributeBonus: 120
  },
  buildAttributes: traitAttributeEffects(TRAIT.CHEMICAL_ROUNDS, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns High Caliber tuning and behavior at its established runtime and build boundaries. */
export const highCaliber = defineTrait({
  id: TRAIT.HIGH_CALIBER,
  name: 'High Caliber',
  balance: {
    criticalChance: 0.15
  },
  modifierRules: [
    {
      order: -13,
      id: 'engineer.high-caliber',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HIGH_CALIBER), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Heavy Metal tuning and behavior at its established runtime and build boundaries. */
export const heavyMetal = defineTrait({
  id: TRAIT.HEAVY_METAL,
  name: 'Heavy Metal',
  balance: {
    lowerThreshold: 0.25,
    middleThreshold: 0.5,
    upperThreshold: 0.75,
    lowerBonus: 0.15,
    middleBonus: 0.1,
    upperBonus: 0.05
  },
  modifierRules: [
    {
      order: -11,
      id: 'engineer.heavy-metal-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',

      amount: (context) => heavyMetalBonus(context),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: -10,
      id: 'engineer.heavy-metal-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',

      factor: (context) => 1 + heavyMetalBonus(context),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Sharpshooter tuning and behavior at its established runtime and build boundaries. */
export const sharpshooter = defineTrait({
  id: TRAIT.SHARPSHOOTER,
  name: 'Sharpshooter',
  balance: {
    coefficientMultiplier: 2 / 3
  }
});

/** Owns Modified Ammunition tuning and behavior at its established runtime and build boundaries. */
export const modifiedAmmunition = defineTrait({
  id: TRAIT.MODIFIED_AMMUNITION,
  name: 'Modified Ammunition',
  modifierRules: [
    {
      order: -17,
      id: 'engineer.modified-ammunition',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        damagePerCondition: 0.01,
        maximumConditions: CANONICAL_TARGET_CONDITIONS.length
      },
      // Count unique conditions only up to the selected balance cap.
      factor: (context, _target, parameters) =>
        1 + Math.min(parameters.maximumConditions, targetConditionCount(context)) * parameters.damagePerCondition,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Reapply selected Firearms duration contributions when a companion replaces baked player attributes. */
export function selectedFirearmsDurationBonuses(context: Gw2ModifierContext): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const [condition, trait] of [
    ['Bleeding', TRAIT.SERRATED_STEEL],
    ['Burning', TRAIT.INCENDIARY_POWDER]
  ] as const) {
    if (hasTrait(context, trait))
      bonuses[condition] =
        100 * balanceProfileNumber(requireBalanceProfileFromContext(context, trait), 'durationMultiplier');
  }

  return bonuses;
}

/** React to accepted conditions with Firearms trait rewards, retaining their eligibility and cooldown rules. */

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Burning' || event.actorType === 'summon' || !hasTrait(context, TRAIT.THERMAL_VISION)) {
    return;
  }

  const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
  // Independent accepted grants retain the longest window when Burning applications overlap.
  const thermalVisionBuff = requireEffect(thermalVisionProfile, 'buff', 'thermal-vision');
  if (thermalVisionBuff) {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: buildEngineerBuff(event, {
        name: 'Thermal Vision',
        kind: 'thermal-vision',
        duration: thermalVisionBuff.duration,
        stacks: 1,
        sourceId: TRAIT.THERMAL_VISION,
        actorType: 'effect'
      })
    });
  }
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfileFromContext(context, TRAIT.SANGUINE_ARRAY);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', 'might');
  if (sanguineArrayMight) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Sanguine Array',
        kind: String(sanguineArrayMight.boon).toLowerCase(),
        stacks: Math.max(1, event.stacks || 1),
        duration: sanguineArrayMight.duration,
        sourceId: TRAIT.SANGUINE_ARRAY,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SANGUINE_ARRAY, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Sanguine Array', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    return;
  }

  const state = context.procs;
  if (!isInternalCooldownReady(event.at, state.deadline('hematicFocus') || 0)) return;
  const hematicFocusProfile = requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', 'fury');
  if (hematicFocusFury) {
    state.setDeadline('hematicFocus', event.at + balanceProfileNumber(hematicFocusProfile, 'internalCooldown'));
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Hematic Focus',
        kind: String(hematicFocusFury.boon).toLowerCase(),
        stacks: Number(hematicFocusFury.stacks),
        duration: hematicFocusFury.duration,
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.HEMATIC_FOCUS, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Hematic Focus', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grant and report No Scope Fury only after the shared critical handler accepts the proc. */
function grantNoScope(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const noScopeProfile = requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE);
  const noScopeFury = requireEffect(noScopeProfile, 'boon', 'fury');
  if (noScopeFury) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'No Scope',
        kind: String(noScopeFury.boon).toLowerCase(),
        stacks: Number(noScopeFury.stacks),
        duration: noScopeFury.duration,
        sourceId: TRAIT.NO_SCOPE,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.NO_SCOPE, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'No Scope', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}
