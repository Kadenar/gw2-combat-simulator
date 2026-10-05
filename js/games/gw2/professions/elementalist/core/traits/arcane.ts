import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistAnnouncement,
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Arcane definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const arcaneProwess = defineTrait({
  id: TRAIT.ARCANE_PROWESS,
  name: 'Arcane Prowess',
  balance: {
    effects: [{ type: 'boon', name: 'Might', boon: 'might', stacks: 1, duration: 8 }]
  }
});

export const arcanePrecision = defineTrait({
  id: TRAIT.ARCANE_PRECISION,
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
  name: 'Renewing Stamina',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 5 }]
  }
});

export const elementalAttunement = defineTrait({
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
  name: 'Evasive Arcana',
  hooks: { eventHandlers: { 'elementalist.evasive-arcana': OBSERVABLE_EVENT_HANDLER } },
  balance: {
    internalCooldown: 10,
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
      { type: 'condition', name: 'Earth Cripple', condition: 'Crippled', stacks: 1, duration: 2 }
    ]
  }
});

export const arcaneLightning = defineTrait({
  id: TRAIT.ARCANE_LIGHTNING,
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
      { type: 'boon', name: 'Arcane Echo', boon: 'quickness', stacks: 1, duration: 4 }
    ]
  }
});

export const bountifulPower = defineTrait({
  id: TRAIT.BOUNTIFUL_POWER,
  name: 'Bountiful Power',
  balance: {
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
      amount: 0.2,
      when: (context) => elementalistTimedBuffStacks(context, 'bountiful-power-active', 1) > 0
    }
  ]
});

// Materialize the current attunement's dodge proc while tracking an independent elemental ICD.
export function triggerEvasiveArcana(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!hasTrait(context, TRAIT.EVASIVE_ARCANA)) return;
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const attunement = state.primaryAttunement;
  const key = `evasiveArcana${attunement}`;
  const evasiveArcanaProfile = requireBalanceProfileFromContext(context, TRAIT.EVASIVE_ARCANA);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown(key, at, balanceProfileNumber(evasiveArcanaProfile, 'internalCooldown'))) return;
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
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at,
            source,
            sourceId: skill.id,
            actorType: 'effect',
            ownerActorType: 'player',
            skillName: source,
            coefficient: effectNumber(evasiveArcanaProfile, evasiveArcanaFireStrike, 'coefficient'),
            skillWeapon: 'Unequipped'
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }

    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.EVASIVE_ARCANA,
        'Fire Burning',
        source,
        skill.id,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    ).length > 0;
  } else if (attunement === 'Air') {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 5,
        at,
        source,
        sourceId: skill.id,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: source
      }
    });
  } else if (attunement === 'Earth') {
    const evasiveArcanaEarthStrike = requireEffect(evasiveArcanaProfile, 'strike', 'Earth');
    if (evasiveArcanaEarthStrike) {
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at,
            source,
            sourceId: skill.id,
            actorType: 'effect',
            skillName: source,
            coefficient: effectNumber(evasiveArcanaProfile, evasiveArcanaEarthStrike, 'coefficient'),
            skillWeapon: 'Unequipped',
            comboFinishers: [{ ownerId: 'elementalist', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }

    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.EVASIVE_ARCANA,
        'Earth Bleeding',
        source,
        skill.id,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    ).length > 0;
    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.EVASIVE_ARCANA,
        'Earth Cripple',
        source,
        skill.id,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    ).length > 0;
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
export function applyArcaneLightning(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!hasTrait(context, TRAIT.ARCANE_LIGHTNING) || skill.skillFamily !== 'Arcane') return;
  const at = cast.effectiveEnd;
  const arcaneLightningProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_LIGHTNING);
  const arcaneWindow = requireEffect(arcaneLightningProfile, 'buff', 'Arcane Lightning');
  if (arcaneWindow) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at,
          source: 'Trait',
          sourceId: TRAIT.ARCANE_LIGHTNING,
          actorType: 'player',
          kind: 'arcane-lightning',
          stacks: Number(arcaneWindow.stacks),
          duration: arcaneWindow.duration,
          skillName: skill.name
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }

  if (skill.id === ID.ARCANE_BRILLIANCE) {
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        at,
        TRAIT.ARCANE_LIGHTNING,
        'Arcane Brilliance',
        skill.name,
        skill.id,
        undefined,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  } else if (skill.id === ID.ARCANE_WAVE) {
    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.ARCANE_LIGHTNING,
        'Arcane Wave',
        skill.name,
        skill.id,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    ).length > 0;
  } else if (skill.id === ID.ARCANE_BLAST) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 5,
        at,
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: skill.name
      }
    });
  } else if (skill.id === ID.ARCANE_ECHO) {
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        at,
        TRAIT.ARCANE_LIGHTNING,
        'Arcane Echo',
        skill.name,
        skill.id,
        undefined,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
}

/** Grants Elemental Lockdown's attunement-specific boon after a classified control event. */
export function applyElementalLockdown(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const state = professionCoreState(context);
  if (!hasTrait(context, TRAIT.ELEMENTAL_LOCKDOWN)) return;
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
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      event.at,
      TRAIT.ELEMENTAL_LOCKDOWN,
      attunement,
      'Elemental Lockdown',
      event.skillId ?? event.sourceId,
      undefined,
      undefined,
      emissionCast
    )
  );
}

/** Preserve the live arcane attribute pass at its original position in the Core modifier pipeline. */
export function applyArcaneTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.ARCANE_LIGHTNING) && elementalistTimedBuffStacks(context, 'arcane-lightning', 1) > 0) {
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
