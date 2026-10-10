import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { heavyMetalBonus } from '#gw2/professions/engineer/core/traits/firearms/modifiers.js';
import { activeBoonStacks, targetConditionCount } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { type EngineerBuild } from '#gw2/professions/engineer/types.js';

import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { mechStruck, type MechStrike } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
/** Owns Serrated Steel tuning and behavior at its established runtime and build boundaries. */
export const serratedSteel = defineTrait({
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.serrated-steel',
        actorTypes: ['player', 'effect', 'unknown'],
        when: (_context, event) => Number(event.coefficient) > 0,
        chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
        randomStream: 'engineer.serrated-steel',
        handler(context, event, _details, application) {
          emitSerratedSteel(context, event, application.quantity, { actorType: 'effect', ownerActorType: 'player' });
        }
      })
    },
    onTriggerPoint(mechStruck, {
      run: (runtime, { cause, details }: MechStrike) => mechSerratedSteel(runtime, cause, details)
    })
  ],
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
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.no-scope',
        actorTypes: ['player'],
        when: (_context, event) => Number(event.coefficient) > 0,
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
  ],
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
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.incendiary-powder-player',
        actorTypes: ['player'],
        when: (_context, event) => Number(event.coefficient) > 0,
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
    },
    onTriggerPoint(mechStruck, {
      run: (runtime, { cause, details }: MechStrike) => mechIncendiaryPowder(runtime, cause, details)
    })
  ],
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
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applyThermalVision }],
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
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applySanguineArray }],
  id: TRAIT.SANGUINE_ARRAY,
  name: 'Sanguine Array',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 4 }]
  }
});

/** Owns Hematic Focus tuning and behavior at its established runtime and build boundaries. */
export const hematicFocus = defineTrait({
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applyHematicFocus }],
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
  if (event.condition !== 'Burning' || event.actorType === 'summon') {
    return;
  }

  const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
  // Independent accepted grants retain the longest window when Burning applications overlap.
  const thermalVisionBuff = requireEffect(thermalVisionProfile, 'buff', 'thermal-vision');
  if (thermalVisionBuff) {
    emitTraitProfile(context, TRAIT.THERMAL_VISION, TRAIT.THERMAL_VISION, event, {
      at: event.at,
      effect: { type: 'buff', name: 'thermal-vision' },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.THERMAL_VISION,
        actorType: 'effect',
        skillId: undefined,
        activationId: event.activationId,
        skillName: 'Thermal Vision',
        triggeredBy: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'Thermal Vision',
        stacks: 1,
        duration: thermalVisionBuff.duration
      })
    });
  }
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon') {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfileFromContext(context, TRAIT.SANGUINE_ARRAY);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', 'might');
  if (sanguineArrayMight) {
    emitTraitProfile(context, TRAIT.SANGUINE_ARRAY, TRAIT.SANGUINE_ARRAY, undefined, {
      at: event.at,
      effect: { type: 'boon', name: 'might' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SANGUINE_ARRAY,
        actorType: 'effect',
        skillId: undefined,
        activationId: undefined,
        skillName: 'Sanguine Array',
        triggeredBy: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'Sanguine Array',
        stacks: Math.max(1, event.stacks || 1),
        duration: sanguineArrayMight.duration
      })
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
  if (event.condition !== 'Bleeding' || event.actorType === 'summon') {
    return;
  }

  const hematicFocusProfile = requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', 'fury');
  // Removed Fury cannot consume recharge; reserve it before delivering a surviving packet.
  if (hematicFocusFury && context.procs.claim(TRAIT.HEMATIC_FOCUS, 'hematicFocus', event.at)) {
    emitTraitProfile(context, TRAIT.HEMATIC_FOCUS, TRAIT.HEMATIC_FOCUS, undefined, {
      at: event.at,
      effect: { type: 'boon', name: 'fury' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: 'effect',
        skillId: undefined,
        activationId: undefined,
        skillName: 'Hematic Focus',
        triggeredBy: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'Hematic Focus',
        stacks: Number(hematicFocusFury.stacks),
        duration: hematicFocusFury.duration
      })
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
    emitTraitProfile(context, TRAIT.NO_SCOPE, TRAIT.NO_SCOPE, undefined, {
      at: event.at,
      effect: { type: 'boon', name: 'fury' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.NO_SCOPE,
        actorType: 'effect',
        skillId: undefined,
        activationId: undefined,
        skillName: 'No Scope',
        triggeredBy: event.skillName
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'No Scope',
        stacks: Number(noScopeFury.stacks),
        duration: noScopeFury.duration
      })
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.NO_SCOPE, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'No Scope', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

// The mech owns independent Firearms proc trackers so its critical hits cannot consume the player's progress.
const mechSerratedSteel = criticalProcHandler<
  EngineerResolverContext,
  EngineerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'engineer.mechanist.serrated-steel-mech',
  actorTypes: ['summon'],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
  randomStream: 'engineer.serrated-steel.mech',
  handler(context, event, _details, application) {
    emitSerratedSteel(context, event, application.quantity, {
      actorType: 'summon',
      metadata: { engineerMech: true }
    });
  }
});

const mechIncendiaryPowder = criticalProcHandler<
  EngineerResolverContext,
  EngineerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'engineer.mechanist.incendiary-powder-mech',
  actorTypes: ['summon'],
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('incendiaryPowder.mech') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('incendiaryPowder.mech', readyAt);
    }
  },
  handler(context, event) {
    emitIncendiaryPowder(context, event, { actorType: 'summon', metadata: { engineerMech: true } });
  }
});

type FirearmsConditionOwner =
  | { readonly actorType: 'effect'; readonly ownerActorType: 'player' }
  | { readonly actorType: 'summon'; readonly metadata: { readonly engineerMech: true } };

/** Share trait tuning and emission order while callers explicitly retain player or companion ownership. */
function emitFirearmsCondition(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  owner: FirearmsConditionOwner,
  sourceId: number,
  name: string,
  condition: string,
  quantity = 1,
  procCount?: number
): void {
  const profile = requireBalanceProfileFromContext(context, sourceId);
  const effect = requireEffect(profile, 'condition', condition);
  if (!effect) return;
  emitTraitProfile(context, sourceId, sourceId, undefined, {
    at: event.at,
    effect: { type: 'condition', name: condition },
    settlement: 'reaction',
    attribution: {
      source: owner.actorType === 'effect' ? 'Trait' : 'engineer',
      sourceId,
      skillName: name,
      ...owner,
      offTarget: event.offTarget,
      triggeredBy: event.skillName,
      metadata: {
        ...(owner.actorType === 'summon' ? { engineerMech: true } : {}),
        ...(procCount == null ? {} : { procCount })
      }
    },
    transform: (packet) => ({
      ...packet,
      applicationIndex: undefined,
      totalApplications: undefined,
      name: name + ' \u2014 ' + packet.condition,
      stacks: Number(packet.stacks) * quantity,
      ...(owner.actorType === 'summon'
        ? {
            summonOwner: event.summonOwner,
            independentConditionOwner: event.independentConditionOwner,
            summonInheritsAttributes: true
          }
        : {})
    })
  });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name, at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

/** Serrated Steel records proc quantity separately from the selected profile's bleeding stack count. */
function emitSerratedSteel(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  quantity: number,
  owner: FirearmsConditionOwner
): void {
  emitFirearmsCondition(context, event, owner, TRAIT.SERRATED_STEEL, 'Serrated Steel', 'Bleeding', quantity, quantity);
}

/** Each eligible Incendiary Powder proc emits one profile application after its actor's cooldown gate. */
function emitIncendiaryPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  owner: FirearmsConditionOwner
): void {
  emitFirearmsCondition(context, event, owner, TRAIT.INCENDIARY_POWDER, 'Incendiary Powder', 'Burning');
}
