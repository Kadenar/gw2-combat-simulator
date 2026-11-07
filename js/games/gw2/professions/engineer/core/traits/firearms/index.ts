import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buffActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, BOON, CONDITION, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  attributeBonusNumber,
  balanceNumber,
  balanceProfileNumber,
  procChance,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mechStruck, type MechStrike } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
import {
  activeBoonStacks,
  engineerEvent,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

export const serratedSteel = defineTrait({
  id: TRAIT.SERRATED_STEEL,
  balance: {
    procRate: {
      id: 'engineer.serrated-steel',
      traitId: TRAIT.SERRATED_STEEL,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    durationMultiplier: 0.33,
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 }]
  },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration': 100 * balanceNumber(balanceContext.catalog, TRAIT.SERRATED_STEEL, 'durationMultiplier')
    }
  }),
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.serrated-steel',
        actorTypes: [ACTOR.PLAYER, ACTOR.EFFECT, ACTOR.UNKNOWN],
        when: (_context, event) => Number(event.coefficient) > 0,
        chanceOnCriticalHit: (context) =>
          procChance(context.helpers, TRAIT.SERRATED_STEEL, context.config.procRateOverrides),
        randomStream: 'engineer.serrated-steel',
        handler(context, event, _details, application) {
          emitSerratedSteel(context, event, application.quantity, {
            actorType: ACTOR.EFFECT,
            ownerActorType: ACTOR.PLAYER
          });
        }
      })
    },
    onTriggerPoint(mechStruck, {
      run: (runtime, { cause, details }: MechStrike) => mechSerratedSteel(runtime, cause, details)
    })
  ]
});

export const noScope = defineTrait({
  id: TRAIT.NO_SCOPE,
  balance: {
    internalCooldown: 8,
    attributeBonuses: { ferocity: 150 },
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 4 }]
  },
  attributes: ({ balanceContext: profileContext, loadout }) => {
    const engineerBuild = loadout;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: attributeBonusNumber(profileContext.catalog, TRAIT.NO_SCOPE, 'ferocity'),
          feedsConversions: 'none',
          enabled: engineerBuild.assumptions.fury !== false
        }
      ]
    };
  },
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.no-scope',
        actorTypes: [ACTOR.PLAYER],
        when: (_context, event) => Number(event.coefficient) > 0,
        internalCooldown: {
          duration: (context) => balanceNumber(context.helpers, TRAIT.NO_SCOPE, 'internalCooldown'),
          key: 'noScope'
        },
        handler: grantNoScope
      })
    }
  ]
});

export const incendiaryPowder = defineTrait({
  id: TRAIT.INCENDIARY_POWDER,
  balance: {
    internalCooldown: 10,
    durationMultiplier: 0.33,
    effects: [{ name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 }]
  },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Burning Duration': 100 * balanceNumber(balanceContext.catalog, TRAIT.INCENDIARY_POWDER, 'durationMultiplier')
    }
  }),
  // Core critical procs open the strike package, ahead of the explosion rewards.
  triggers: [
    {
      on: 'damage.resolved',
      run: criticalProcHandler({
        id: 'engineer.core.incendiary-powder-player',
        actorTypes: [ACTOR.PLAYER],
        when: (_context, event) => Number(event.coefficient) > 0,
        internalCooldown: {
          duration: (context) => balanceNumber(context.helpers, TRAIT.INCENDIARY_POWDER, 'internalCooldown'),
          key: 'incendiaryPowder.player'
        },
        handler(context, event) {
          emitIncendiaryPowder(context, event, { actorType: ACTOR.EFFECT, ownerActorType: ACTOR.PLAYER });
        }
      })
    },
    onTriggerPoint(mechStruck, {
      run: (runtime, { cause, details }: MechStrike) => mechIncendiaryPowder(runtime, cause, details)
    })
  ]
});

export const thermalVision = defineTrait({
  id: TRAIT.THERMAL_VISION,
  balance: {
    conditionDamageIncrease: 0.05,
    attributeBonuses: { expertise: 150 },
    effects: [{ name: 'thermal-vision', type: 'buff', kind: 'thermal-vision', stacks: 1, duration: 4 }]
  },
  attributes: traitAttributeEffects(TRAIT.THERMAL_VISION, [{ kind: 'flat', to: 'Expertise', feedsConversions: 'all' }]),
  modifierRules: [
    {
      order: -8,
      // Accepted Burning-triggered buff windows own the modifier lifetime.
      id: 'engineer.thermal-vision-damage',
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumber(context.catalog, TRAIT.THERMAL_VISION, 'conditionDamageIncrease'),
      when: (context) => buffActive(context, 'thermal-vision')
    }
  ],
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applyThermalVision }]
});

export const sanguineArray = defineTrait({
  id: TRAIT.SANGUINE_ARRAY,
  balance: {
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 1, duration: 4 }]
  },
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applySanguineArray }]
});

export const hematicFocus = defineTrait({
  id: TRAIT.HEMATIC_FOCUS,
  balance: {
    criticalChance: 0.15,
    internalCooldown: 8,
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      order: -5,
      id: 'engineer.hematic-focus',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.HEMATIC_FOCUS, 'criticalChance'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, boonKey(BOON.FURY), 1) > 0
    }
  ],
  // Selection and isolation gate the accepted-condition reward before any proc claim.
  triggers: [{ on: 'condition.applied', run: applyHematicFocus }]
});

export const chemicalRounds = defineTrait({
  id: TRAIT.CHEMICAL_ROUNDS,
  balance: {
    conditionDurationMultiplier: 4 / 3,
    attributeBonuses: { conditionDamage: 120 }
  },
  attributes: traitAttributeEffects(TRAIT.CHEMICAL_ROUNDS, [
    { kind: 'flat', to: 'Condition Damage', feedsConversions: 'all' }
  ]),
  // Keep the pistol multiplier outside the capped duration stage.
  modifierRules: [
    {
      id: 'engineer.chemical-rounds-base-duration',
      target: MODIFIER_TARGET.CONDITION_BASE_DURATION,
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.CHEMICAL_ROUNDS, 'conditionDurationMultiplier'),
      when: chemicalRoundsEligible
    }
  ]
});

export const highCaliber = defineTrait({
  id: TRAIT.HIGH_CALIBER,
  balance: {
    criticalChance: 0.15
  },
  modifierRules: [
    {
      order: -13,
      id: 'engineer.high-caliber',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.HIGH_CALIBER, 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const heavyMetal = defineTrait({
  id: TRAIT.HEAVY_METAL,
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

export const sharpshooter = defineTrait({
  id: TRAIT.SHARPSHOOTER,
  balance: {
    coefficientMultiplier: 2 / 3
  },
  // Sample final Power after specialization, relics, and actor projection.
  attributes: (context) => ({
    finalCondition: {
      condition: CONDITION.BLEEDING,
      powerMultiplier: balanceNumber(context.balanceContext.catalog, TRAIT.SHARPSHOOTER, 'coefficientMultiplier')
    }
  })
});

export const modifiedAmmunition = defineTrait({
  id: TRAIT.MODIFIED_AMMUNITION,
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damagePerCondition: 0.01, maximumConditions: CANONICAL_TARGET_CONDITIONS.length },
  modifierRules: [
    {
      order: -17,
      id: 'engineer.modified-ammunition',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      // Count unique conditions only up to the selected balance cap.
      factor: (context) =>
        1 +
        Math.min(
          balanceNumber(context.catalog, TRAIT.MODIFIED_AMMUNITION, 'maximumConditions'),
          targetConditionCount(context)
        ) *
          balanceNumber(context.catalog, TRAIT.MODIFIED_AMMUNITION, 'damagePerCondition'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Resolve the selected Firearms durations for an independent companion. */
export function selectedFirearmsDurationBonuses(context: Gw2ModifierContext): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const [condition, trait] of [
    [CONDITION.BLEEDING, TRAIT.SERRATED_STEEL],
    [CONDITION.BURNING, TRAIT.INCENDIARY_POWDER]
  ] as const) {
    if (hasTrait(context, trait))
      bonuses[condition] = 100 * balanceNumber(context.catalog, trait, 'durationMultiplier');
  }

  return bonuses;
}

/** React to accepted conditions with Firearms trait rewards, retaining their eligibility and cooldown rules. */

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== CONDITION.BURNING || event.actorType === ACTOR.SUMMON) {
    return;
  }

  const thermalVisionProfile = requireBalanceProfile(context.helpers, TRAIT.THERMAL_VISION);
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
        actorType: ACTOR.EFFECT,
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
  if (event.condition !== CONDITION.BLEEDING || event.actorType === ACTOR.SUMMON) {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfile(context.helpers, TRAIT.SANGUINE_ARRAY);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', boonKey(BOON.MIGHT));

  if (sanguineArrayMight) {
    emitTraitProfile(context, TRAIT.SANGUINE_ARRAY, TRAIT.SANGUINE_ARRAY, undefined, {
      at: event.at,
      effect: { type: 'boon', name: boonKey(BOON.MIGHT) },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SANGUINE_ARRAY,
        actorType: ACTOR.EFFECT,
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
      attribution: { source: 'Trait', sourceId: TRAIT.SANGUINE_ARRAY, actorType: ACTOR.EFFECT },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Sanguine Array', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== CONDITION.BLEEDING || event.actorType === ACTOR.SUMMON) {
    return;
  }

  const hematicFocusProfile = requireBalanceProfile(context.helpers, TRAIT.HEMATIC_FOCUS);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', boonKey(BOON.FURY));

  // Removed Fury cannot consume recharge; reserve it before delivering a surviving packet.
  if (hematicFocusFury && context.procs.claim(TRAIT.HEMATIC_FOCUS, 'hematicFocus', event.at)) {
    emitTraitProfile(context, TRAIT.HEMATIC_FOCUS, TRAIT.HEMATIC_FOCUS, undefined, {
      at: event.at,
      effect: { type: 'boon', name: boonKey(BOON.FURY) },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: ACTOR.EFFECT,
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
      attribution: { source: 'Trait', sourceId: TRAIT.HEMATIC_FOCUS, actorType: ACTOR.EFFECT },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Hematic Focus', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grant and report No Scope Fury only after the shared critical handler accepts the proc. */
function grantNoScope(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const noScopeProfile = requireBalanceProfile(context.helpers, TRAIT.NO_SCOPE);
  const noScopeFury = requireEffect(noScopeProfile, 'boon', boonKey(BOON.FURY));

  if (noScopeFury) {
    emitTraitProfile(context, TRAIT.NO_SCOPE, TRAIT.NO_SCOPE, undefined, {
      at: event.at,
      effect: { type: 'boon', name: boonKey(BOON.FURY) },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.NO_SCOPE,
        actorType: ACTOR.EFFECT,
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
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: Number(noScopeFury.stacks),
        duration: noScopeFury.duration
      })
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.NO_SCOPE, actorType: ACTOR.EFFECT },
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
  actorTypes: [ACTOR.SUMMON],
  chanceOnCriticalHit: (context) => procChance(context.helpers, TRAIT.SERRATED_STEEL, context.config.procRateOverrides),
  randomStream: 'engineer.serrated-steel.mech',
  handler(context, event, _details, application) {
    emitSerratedSteel(context, event, application.quantity, {
      actorType: ACTOR.SUMMON,
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
  actorTypes: [ACTOR.SUMMON],
  internalCooldown: {
    duration: (context) => balanceNumber(context.helpers, TRAIT.INCENDIARY_POWDER, 'internalCooldown'),
    key: 'incendiaryPowder.mech'
  },
  handler(context, event) {
    emitIncendiaryPowder(context, event, { actorType: ACTOR.SUMMON, metadata: { engineerMech: true } });
  }
});

type FirearmsConditionOwner =
  | { readonly actorType: typeof ACTOR.EFFECT; readonly ownerActorType: typeof ACTOR.PLAYER }
  | { readonly actorType: typeof ACTOR.SUMMON; readonly metadata: { readonly engineerMech: true } };

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
  const profile = requireBalanceProfile(context.helpers, sourceId);
  const effect = requireEffect(profile, 'condition', condition);

  if (!effect) return;

  emitTraitProfile(context, sourceId, sourceId, undefined, {
    at: event.at,
    effect: { type: 'condition', name: condition },
    settlement: 'reaction',
    attribution: {
      source: owner.actorType === ACTOR.EFFECT ? 'Trait' : 'engineer',
      sourceId,
      skillName: name,
      ...owner,
      offTarget: event.offTarget,
      triggeredBy: event.skillName,
      metadata: {
        ...(owner.actorType === ACTOR.SUMMON ? { engineerMech: true } : {}),
        ...(procCount == null ? {} : { procCount })
      }
    },
    transform: (packet) => ({
      ...packet,
      applicationIndex: undefined,
      totalApplications: undefined,
      name: name + ' - ' + packet.condition,
      stacks: Number(packet.stacks) * quantity,
      ...(owner.actorType === ACTOR.SUMMON
        ? {
            summonOwner: event.summonOwner,
            independentConditionOwner: event.independentConditionOwner,
            summonInheritsAttributes: true
          }
        : {})
    })
  });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId, actorType: ACTOR.EFFECT },
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
  emitFirearmsCondition(
    context,
    event,
    owner,
    TRAIT.SERRATED_STEEL,
    'Serrated Steel',
    CONDITION.BLEEDING,
    quantity,
    quantity
  );
}

/** Each eligible Incendiary Powder proc emits one profile application after its actor's cooldown gate. */
function emitIncendiaryPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  owner: FirearmsConditionOwner
): void {
  emitFirearmsCondition(context, event, owner, TRAIT.INCENDIARY_POWDER, 'Incendiary Powder', CONDITION.BURNING);
}

// Pistol conditions extend their base duration; trait procs keep their own authored duration.
function chemicalRoundsEligible(context: Gw2ModifierContext): boolean {
  const event = engineerEvent(context);
  const application = event?.application || event;

  if (application?.source === 'Trait') return false;

  const skill = skillForEvent(context.catalog, context.event, context.skillId);
  return (
    event?.skillWeapon === WEAPON.PISTOL ||
    event?.application?.skillWeapon === WEAPON.PISTOL ||
    skill?.weapon === WEAPON.PISTOL
  );
}

/** Selects Heavy Metal's critical bonus from the target's current health tier. */
function heavyMetalBonus(context: Gw2ModifierContext): number {
  const fraction = targetHealthFraction(context);
  const heavyMetalProfile = requireBalanceProfile(context.catalog, TRAIT.HEAVY_METAL);

  if (fraction < balanceProfileNumber(heavyMetalProfile, 'lowerThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'lowerBonus');

  if (fraction < balanceProfileNumber(heavyMetalProfile, 'middleThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'middleBonus');

  if (fraction < balanceProfileNumber(heavyMetalProfile, 'upperThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'upperBonus');

  return 0;
}
