import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import {
  attunementChanged,
  attunementsCounted,
  type ElementalistAttunementChanged,
  type ElementalistAttunementCount
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import {
  elementalistAnnouncement,
  elementalistEventSkill
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  controlAccepted,
  elementalistCastCompleted,
  elementalistDamageResolved,
  elementalistDodgeCompleted,
  type ElementalistCastCompleted,
  type ElementalistDamageResolved,
  type ElementalistReaction
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';

/** Arcane definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const arcaneProwess = defineTrait({
  triggers: [
    onTriggerPoint(attunementChanged, {
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementChanged) =>
        applyArcaneProwess(runtime, input.at, input.skill.id, input.emissionCast)
    })
  ],
  id: TRAIT.ARCANE_PROWESS,
  name: 'Arcane Prowess',
  balance: {
    effects: [{ type: 'boon', name: 'Might', boon: 'might', stacks: 1, duration: 8 }]
  }
});

export const arcanePrecision = defineTrait({
  id: TRAIT.ARCANE_PRECISION,
  triggers: [
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistResolverContext, { cause, details }: ElementalistDamageResolved) =>
        arcanePrecisionCritical(runtime, cause, details)
    })
  ],
  name: 'Arcane Precision',
  balance: {
    procChance: 0.33,
    internalCooldown: 3,
    effects: [
      { type: 'condition', name: 'Fire', condition: 'Burning', stacks: 1, duration: 1.5 },
      { type: 'condition', name: 'Water', condition: 'Vulnerability', stacks: 1, duration: 10 },
      { type: 'condition', name: 'Air', condition: 'Weakness', stacks: 1, duration: 3 },
      { type: 'condition', name: 'Earth', condition: 'Bleeding', stacks: 1, duration: 5 }
    ]
  }
});

export const renewingStamina = defineTrait({
  id: TRAIT.RENEWING_STAMINA,
  triggers: [
    onTriggerPoint(elementalistDamageResolved, {
      run: (runtime: ElementalistResolverContext, { cause, details }: ElementalistDamageResolved) =>
        renewingStaminaCritical(runtime, cause, details)
    })
  ],
  name: 'Renewing Stamina',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 5 }]
  }
});

export const elementalAttunement = defineTrait({
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistAttunementChanged) =>
        !input.dualAttunement || input.target !== input.previous,
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementChanged) =>
        grantElementalAttunementBoon(runtime, input.at, input.target, input.skill.id, input.emissionCast)
    })
  ],
  id: TRAIT.ELEMENTAL_ATTUNEMENT,
  name: 'Elemental Attunement',
  balance: {
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 1, duration: 15 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 8 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 5 }
    ]
  }
});

export const elementalLockdown = defineTrait({
  triggers: [
    onTriggerPoint(controlAccepted, {
      run: (runtime: ElementalistRuntime, { cause }: ElementalistReaction) => applyElementalLockdown(runtime, cause)
    })
  ],
  id: TRAIT.ELEMENTAL_LOCKDOWN,
  name: 'Elemental Lockdown',
  balance: {
    internalCooldown: 1,
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 5, duration: 5 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Air', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 4 }
    ]
  }
});

export const elementalEnchantment = defineTrait({
  id: TRAIT.ELEMENTAL_ENCHANTMENT,
  name: 'Elemental Enchantment',
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.overload) || skill.skillFamily === 'Jade Sphere',
      multiplier: { profile: TRAIT.ELEMENTAL_ENCHANTMENT, field: 'rechargeMultiplier' }
    }
  ],
  balance: {
    attributeBonus: 180,
    rechargeMultiplier: 0.85
  },
  buildAttributes: traitAttributeEffects(TRAIT.ELEMENTAL_ENCHANTMENT, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const evasiveArcana = defineTrait({
  id: TRAIT.EVASIVE_ARCANA,
  triggers: [onTriggerPoint(elementalistDodgeCompleted, { run: triggerEvasiveArcana })],
  name: 'Evasive Arcana',
  lifetime: { eventHandlers: { 'elementalist.evasive-arcana': OBSERVABLE_EVENT_HANDLER } },
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        name: 'Fire',
        coefficient: 1,
        hits: 1
      },
      { type: 'condition', name: 'Fire Burning', condition: 'Burning', stacks: 3, duration: 6 },
      { type: 'strike', name: 'Earth', coefficient: 0.5, hits: 1 },
      { type: 'condition', name: 'Earth Bleeding', condition: 'Bleeding', stacks: 1, duration: 20 },
      { type: 'condition', name: 'Earth Cripple', condition: 'Crippled', stacks: 1, duration: 2 },
      { type: 'condition', name: 'Air Blindness', condition: 'Blindness', stacks: 1, duration: 5 }
    ]
  }
});

export const arcaneLightning = defineTrait({
  id: TRAIT.ARCANE_LIGHTNING,
  triggers: [onTriggerPoint(elementalistCastCompleted, { run: applyArcaneLightning })],
  name: 'Arcane Lightning',
  balance: {
    attributeBonus: 150,
    effects: [
      {
        type: 'buff',
        name: 'Arcane Lightning',
        kind: 'arcane-lightning',
        stacks: 1,
        duration: 15
      },
      { type: 'boon', name: 'Arcane Brilliance', boon: 'protection', stacks: 1, duration: 3.5 },
      { type: 'condition', name: 'Arcane Wave', condition: 'Immobilized', stacks: 1, duration: 2 },
      { type: 'boon', name: 'Arcane Echo', boon: 'quickness', stacks: 1, duration: 4 },
      { type: 'condition', name: 'Arcane Blast', condition: 'Blindness', stacks: 1, duration: 5 }
    ]
  }
});

export const bountifulPower = defineTrait({
  triggers: [
    onTriggerPoint(attunementChanged, {
      when: (_runtime: unknown, input: ElementalistAttunementChanged) => !input.dualAttunement,
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementChanged) =>
        triggerBountifulPower(runtime, input.at, 1, input.skill.id, input.emissionCast)
    }),
    onTriggerPoint(attunementsCounted, {
      run: (runtime: ElementalistRuntime, input: ElementalistAttunementCount) =>
        triggerBountifulPower(runtime, input.at, input.stacks, input.sourceId, input.emissionCast)
    })
  ],
  id: TRAIT.BOUNTIFUL_POWER,
  name: 'Bountiful Power',
  balance: {
    damageIncrease: 0.2,
    threshold: 5,
    effects: [
      { type: 'boon', name: 'Quickness', boon: 'quickness', stacks: 1, duration: 5 },
      {
        type: 'buff',
        name: 'Damage Window',
        kind: 'bountiful-power-active',
        stacks: 1,
        duration: 7
      }
    ]
  },
  modifierRules: [
    {
      id: 'elementalist.bountiful-power',
      // Keep the original additive rule order before the registered Persisting Flames contribution.
      order: -12,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_POWER), 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'bountiful-power-active', 1) > 0
    }
  ]
});

// Materialize the current attunement's dodge proc while tracking an independent elemental ICD.
function triggerEvasiveArcana(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;

  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  const evasiveArcanaProfile = requireBalanceProfileFromContext(context, TRAIT.EVASIVE_ARCANA);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claim(TRAIT.EVASIVE_ARCANA, key, at)) return;
  const source =
    attunement === 'Fire'
      ? 'Flame Burst (trait)'
      : attunement === 'Water'
        ? 'Cleansing Wave (trait)'
        : attunement === 'Air'
          ? 'Blinding Flash (trait)'
          : 'Shock Wave (trait)';
  // Water is heal/cleanse only, so it emits no offensive packet beyond the marker.
  if (attunement === 'Fire') {
    const evasiveArcanaFireStrike = requireEffect(evasiveArcanaProfile, 'strike', 'Fire');
    if (evasiveArcanaFireStrike) {
      emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'strike', name: 'Fire' },
        cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
        skillWeaponFallback: 'Unequipped',
        attribution: {
          source: source,
          sourceId: skill.id,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: source,
          skillId: skill.id,
          name: source,
          activationId: context.combat.allocateEffectActivation('elementalist.effect:')
        }
      });
    }

    emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Fire Burning' },
      skillId: skill.id,
      skillName: source,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: source, sourceId: skill.id, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: source + ' \u2014 ' + event.condition })
    });
  } else if (attunement === 'Air') {
    // Air's optional Blindness uses the same patchable emission contract as Fire and Earth.
    emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
      at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Air Blindness' },
      attribution: { source, sourceId: skill.id, actorType: 'effect', ownerActorType: 'player', skillName: source }
    });
  } else if (attunement === 'Earth') {
    const evasiveArcanaEarthStrike = requireEffect(evasiveArcanaProfile, 'strike', 'Earth');
    if (evasiveArcanaEarthStrike) {
      emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'strike', name: 'Earth' },
        cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
        skillWeaponFallback: 'Unequipped',
        attribution: {
          source: source,
          sourceId: skill.id,
          actorType: 'effect',
          skillName: source,
          skillId: skill.id,
          name: source,
          activationId: context.combat.allocateEffectActivation('elementalist.effect:')
        },
        transform: (packet) => ({
          ...packet,
          comboFinishers: [{ ownerId: 'elementalist', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
        })
      });
    }

    emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Earth Bleeding' },
      skillId: skill.id,
      skillName: source,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: source, sourceId: skill.id, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: source + ' \u2014 ' + event.condition })
    });
    emitTraitProfile(context, TRAIT.EVASIVE_ARCANA, TRAIT.EVASIVE_ARCANA, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Earth Cripple' },
      skillId: skill.id,
      skillName: source,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: source, sourceId: skill.id, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: source + ' \u2014 ' + event.condition })
    });
  }

  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'elementalist.evasive-arcana',
      at,
      source,
      sourceId: skill.id,
      actorType: 'effect',
      skillName: source,
      attunement
    }
  });
  context.effects.emit(
    elementalistAnnouncement({
      at,
      name: source,
      procType: 'trait',
      sourceId: skill.id,
      sourceSkill: skill.name
    })
  );
}

/** Applies Arcane Lightning's shared ferocity window and named Arcane-skill follow-up. */
function applyArcaneLightning(context: ElementalistRuntime, { cast }: ElementalistCastCompleted): void {
  const skill = cast.skill;
  if (skill.skillFamily !== 'Arcane') return;
  const at = cast.effectiveEnd;
  const arcaneLightningProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_LIGHTNING);
  const arcaneWindow = requireEffect(arcaneLightningProfile, 'buff', 'Arcane Lightning');
  if (arcaneWindow) {
    emitTraitProfile(context, TRAIT.ARCANE_LIGHTNING, TRAIT.ARCANE_LIGHTNING, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'buff', name: 'Arcane Lightning' },
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        name: skill.name
      },
      transform: (packet) => ({ ...packet, kind: 'arcane-lightning' })
    });
  }

  if (skill.id === ID.ARCANE_BRILLIANCE) {
    emitTraitProfile(context, TRAIT.ARCANE_LIGHTNING, TRAIT.ARCANE_LIGHTNING, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: 'Arcane Brilliance' },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'player',
        name: skill.name,
        priority: 0
      }
    });
  } else if (skill.id === ID.ARCANE_WAVE) {
    emitTraitProfile(context, TRAIT.ARCANE_LIGHTNING, TRAIT.ARCANE_LIGHTNING, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Arcane Wave' },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: skill.name, sourceId: skill.id, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: skill.name + ' \u2014 ' + event.condition })
    });
  } else if (skill.id === ID.ARCANE_BLAST) {
    // Arcane Blast's trait condition can be tuned or removed independently of the native skill.
    emitTraitProfile(context, TRAIT.ARCANE_LIGHTNING, TRAIT.ARCANE_LIGHTNING, undefined, {
      at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Arcane Blast' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: skill.name
      }
    });
  } else if (skill.id === ID.ARCANE_ECHO) {
    emitTraitProfile(context, TRAIT.ARCANE_LIGHTNING, TRAIT.ARCANE_LIGHTNING, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: 'Arcane Echo' },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'player',
        name: skill.name,
        priority: 0
      }
    });
  }
}

/** Grants Elemental Lockdown's attunement-specific boon after a classified control event. */
function applyElementalLockdown(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const state = professionCoreState(context);
  const elementalLockdownProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_LOCKDOWN);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !context.procs.claimCooldown(
      'elementalLockdown',
      event.at,
      balanceProfileNumber(elementalLockdownProfile, 'internalCooldown')
    )
  )
    return;
  const attunement = state.primaryAttunement;
  emitTraitProfile(context, TRAIT.ELEMENTAL_LOCKDOWN, TRAIT.ELEMENTAL_LOCKDOWN, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: attunement },
    skillId: event.skillId ?? event.sourceId,
    skillName: 'Elemental Lockdown',
    cast: emissionCast,
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.ELEMENTAL_LOCKDOWN,
      actorType: 'player',
      name: 'Elemental Lockdown',
      priority: 0
    }
  });
}

/** Preserve the live arcane attribute pass at its original position in the Core modifier pipeline. */
export function applyArcaneTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.ARCANE_LIGHTNING) && activeBuffStacks(context, 'arcane-lightning', 1) > 0) {
    const arcaneLightningProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_LIGHTNING);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(arcaneLightningProfile, 'attributeBonus');
  }
}

/** Multiply in-combat attunement recharge before the specialization's flat reduction and recharge-rate conversion. */
export function elementalEnchantmentRecharge(context: ElementalistRuntime, seconds: number): number {
  return hasTrait(context, TRAIT.ELEMENTAL_ENCHANTMENT)
    ? seconds *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_ENCHANTMENT),
          'rechargeMultiplier'
        )
    : seconds;
}

/** Materializes Arcane Precision after its registered critical-hit reaction succeeds. */
function applyArcanePrecision(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const attunement = professionCoreState(context).primaryAttunement;
  const arcanePrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION);
  const condition = requireEffect(arcanePrecisionProfile, 'condition', attunement);

  if (condition) {
    emitTraitProfile(context, TRAIT.ARCANE_PRECISION, TRAIT.ARCANE_PRECISION, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: attunement },
      settlement: 'reaction',
      attribution: {
        source: 'Arcane Precision',
        sourceId: TRAIT.ARCANE_PRECISION,
        actorType: 'player',
        skillName: 'Arcane Precision',
        triggeredBy: resolverSourceSkill(event)
      },
      transform: (packet) => ({ ...packet, name: 'Arcane Precision' + ' — ' + packet.condition })
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Arcane Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
function applyRenewingStamina(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const renewingStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA);
  const vigor = requireEffect(renewingStaminaProfile, 'boon', 'Vigor');
  if (vigor) {
    emitTraitProfile(context, TRAIT.RENEWING_STAMINA, TRAIT.RENEWING_STAMINA, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'boon', name: 'Vigor' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.RENEWING_STAMINA,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA).name,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      },
      transform: (packet) => ({
        ...packet,
        name: requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA).name
      })
    });
  }
}

/** Keep arcanePrecision's critical sampling and timer with its effect owner; the trigger point fixes cross-trait order. */
const arcanePrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.arcane-precision',
  chanceOnCriticalHit: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'procChance'),
  when: (_context, event, details) => criticalTraitEligible(event, details),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('arcanePrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('arcanePrecision', readyAt);
    }
  },
  randomStream: 'elementalist.arcane-precision',
  handler: applyArcanePrecision
});

/** Keep renewingStamina's critical sampling and timer with its effect owner; the trigger point fixes cross-trait order. */
const renewingStaminaCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.renewing-stamina',
  when: (_context, event, details) => criticalTraitEligible(event, details),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('renewingStamina') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('renewingStamina', readyAt);
    }
  },
  handler: applyRenewingStamina
});

/** Grants Arcane Prowess might for one completed attunement transition. */
function applyArcaneProwess(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  {
    emitTraitProfile(context, TRAIT.ARCANE_PROWESS, TRAIT.ARCANE_PROWESS, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: 'Might' },
      skillId: sourceId,
      skillName: 'Arcane Prowess',
      cast: emissionCast,
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.ARCANE_PROWESS,
        actorType: 'player',
        name: 'Arcane Prowess',
        priority: 0
      }
    });
  }
}

/** Grants Elemental Attunement's boon matching the element just entered. */
function grantElementalAttunementBoon(
  context: ElementalistRuntime,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  emitTraitProfile(context, TRAIT.ELEMENTAL_ATTUNEMENT, TRAIT.ELEMENTAL_ATTUNEMENT, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: attunement },
    skillId: sourceId,
    skillName: 'Elemental Attunement',
    cast: emissionCast,
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.ELEMENTAL_ATTUNEMENT,
      actorType: 'player',
      name: 'Elemental Attunement',
      priority: 0
    }
  });
}

/** Accumulates Bountiful Power swaps and grants each completed threshold's timed effects. */
function triggerBountifulPower(
  context: ElementalistRuntime,
  at: number,
  stacks: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  const bountifulPowerProfile = requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_POWER);
  const threshold = balanceProfileNumber(bountifulPowerProfile, 'threshold');
  // Nonpositive custom thresholds disable this proc.
  if (threshold <= 0) return;
  const state = professionCoreState(context);
  // Reaching the stack cap grants one buff package and resets buildup before rewards can start a new cycle.
  const progress = advanceCounter(state.bountifulPowerProgress, stacks, threshold, 'reset');
  state.bountifulPowerProgress = progress.value;
  if (!progress.reached) return;
  emitTraitProfile(context, TRAIT.BOUNTIFUL_POWER, TRAIT.BOUNTIFUL_POWER, undefined, {
    at: at,
    fullEnd: at,
    effect: { type: 'boon', name: 'Quickness' },
    skillId: sourceId,
    skillName: 'Bountiful Power',
    cast: emissionCast,
    priority: 0,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.BOUNTIFUL_POWER,
      actorType: 'player',
      name: 'Bountiful Power',
      priority: 0
    }
  });
  const active = requireEffect(bountifulPowerProfile, 'buff', 'Damage Window');
  if (active) {
    emitTraitProfile(context, TRAIT.BOUNTIFUL_POWER, TRAIT.BOUNTIFUL_POWER, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'buff', name: 'Damage Window' },
      cast: emissionCast,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BOUNTIFUL_POWER,
        actorType: 'player',
        skillName: 'Bountiful Power',
        skillId: elementalistEventSkill(context, 'Bountiful Power', sourceId).id,
        name: 'Bountiful Power'
      },
      transform: (packet) => ({ ...packet, kind: 'bountiful-power-active' })
    });
  }
}
