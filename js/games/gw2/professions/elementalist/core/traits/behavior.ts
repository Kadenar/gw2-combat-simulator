import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { powerScaledConditionAttributes } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  combatStarted,
  elementalistAnnouncement,
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  elementalistMightStacks,
  elementalistTimedBuffStacks,
  primaryAttunement
} from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistModifierContext,
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
export function applyInscriptionPostCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!hasTrait(context, TRAIT.INSCRIPTION) || skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      cast.effectiveEnd,
      TRAIT.INSCRIPTION,
      state.primaryAttunement,
      skill.name,
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Materializes Lightning Rod from a classified player control event. */
export function applyLightningRod(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  if (!hasTrait(context, TRAIT.LIGHTNING_ROD)) return;
  const sourceId = event.skillId ?? event.sourceId;
  const lightningRodProfile = requireBalanceProfileFromContext(context, TRAIT.LIGHTNING_ROD);
  const lightningRodStrike = requireEffect(lightningRodProfile, 'strike', 'Lightning Rod');
  if (lightningRodStrike) {
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          cause: event,
          at: event.at,
          source: 'Lightning Rod',
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Lightning Rod',
          coefficient: effectNumber(lightningRodProfile, lightningRodStrike, 'coefficient'),
          skillWeapon: 'Unequipped'
        },
        emissionCast
      )
    );
  }

  const conditionEmitted =
    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        event.at,
        TRAIT.LIGHTNING_ROD,
        'Lightning Rod',
        'Lightning Rod',
        sourceId,
        undefined,
        emissionCast
      )
    ).length > 0;
  if (lightningRodStrike || conditionEmitted)
    context.effects.emit(
      elementalistAnnouncement({
        at: event.at,
        name: 'Lightning Rod',
        procType: 'trait',
        sourceId,
        sourceSkill: event.skillName || event.source || ''
      })
    );
}

/** Both aura paths select the same profile effects before applying their own duration policy. */
function zephyrsBoonEffects(context: unknown) {
  return ['Fury', 'Swiftness'].flatMap((name) => {
    const zephyrsBoonProfile = requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON);
    const effect = requireEffect(zephyrsBoonProfile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: effect.duration
      }
    ];
  });
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
export function applyResolverZephyrsBoon(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.ZEPHYRS_BOON)) return;
  for (const boon of zephyrsBoonEffects(context)) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.ZEPHYRS_BOON,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_BOON).name,
        kind: boon.kind.toLowerCase(),
        stacks: boon.stacks,
        duration: boon.duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
  }
}

/** Preserve the live air attribute pass at its original position in the Core modifier pipeline. */
export function applyAirTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.FRESH_AIR) && elementalistTimedBuffStacks(context, 'fresh air', 1) > 0) {
    const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(freshAirProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.AEROMANCERS_TRAINING) && primary === 'Air') {
    const aeromancersTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.AEROMANCERS_TRAINING);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(aeromancersTrainingProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.RAGING_STORM) &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    const ragingStormProfile = requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(ragingStormProfile, 'attributeBonus');
  }
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function aeromancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Air' && hasTrait(context, TRAIT.AEROMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.AEROMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}

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
        type: 'blind',
        at,
        source,
        sourceId: skill.id,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: source,
        controlKind: 'blind'
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
          kind: 'arcane lightning',
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
        type: 'blind',
        at,
        source: 'Trait',
        sourceId: TRAIT.ARCANE_LIGHTNING,
        actorType: 'effect',
        skillName: skill.name,
        controlKind: 'blind'
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
  if (hasTrait(context, TRAIT.ARCANE_LIGHTNING) && elementalistTimedBuffStacks(context, 'arcane lightning', 1) > 0) {
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

/** Grants Earth's Embrace Resistance from an eligible healing skill. */
export function applyEarthsEmbrace(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const at = cast.effectiveEnd;
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.EARTHS_EMBRACE)) return;
  const earthsEmbraceProfile = requireBalanceProfileFromContext(context, TRAIT.EARTHS_EMBRACE);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('earthsEmbrace', at, balanceProfileNumber(earthsEmbraceProfile, 'internalCooldown')))
    return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.EARTHS_EMBRACE,
      'Resistance',
      "Earth's Embrace",
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Applies Written in Stone's signet-specific aura after a completed signet cast. */
export function applyWrittenInStone(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  if (!hasTrait(context, TRAIT.WRITTEN_IN_STONE) || skill.skillFamily !== 'Signet') return;
  const signet =
    skill.id === ID.SIGNET_OF_RESTORATION
      ? 'Restoration'
      : skill.id === ID.SIGNET_OF_FIRE
        ? 'Fire'
        : skill.id === ID.SIGNET_OF_EARTH
          ? 'Earth'
          : null;
  if (!signet) return;
  const writtenInStoneProfile = requireBalanceProfileFromContext(context, TRAIT.WRITTEN_IN_STONE);
  const effect = requireEffect(writtenInStoneProfile, 'buff', signet);
  if (effect) {
    applyAura(context, {
      at: cast.effectiveEnd,
      aura: String(effect.kind),
      duration: effect.duration,
      skillName: 'Written in Stone',
      sourceId: skill.id
    });
  }
}

/** Applies Strength of Stone after an already-classified immobilize event. */
export function applyStrengthOfStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.STRENGTH_OF_STONE)) return;
  const strengthOfStoneProfile = requireBalanceProfileFromContext(context, TRAIT.STRENGTH_OF_STONE);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !context.procs.claimCooldown(
      'strengthOfStone',
      event.at,
      balanceProfileNumber(strengthOfStoneProfile, 'internalCooldown')
    )
  )
    return;
  const bleeding = requireEffect(strengthOfStoneProfile, 'condition', 'Strength of Stone');
  if (bleeding) {
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Strength of Stone',
        sourceId: 'Strength of Stone',
        actorType: 'player',
        skillName: 'Strength of Stone',
        condition: String(bleeding.condition),
        stacks: Number(bleeding.stacks),
        duration: Number(bleeding.duration),
        triggeredBy: resolverSourceSkill(event)
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Strength of Stone', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Shares Elemental Shielding's profile defaults without coupling phase-specific boon application. */
function elementalShieldingEffect(context: unknown) {
  const elementalShieldingProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING);
  const effect = requireEffect(elementalShieldingProfile, 'boon', 'Protection');
  if (!effect) return undefined;
  return {
    kind: String(effect.boon).toLowerCase(),
    stacks: Number(effect.stacks),
    duration: effect.duration
  };
}

/** Grants resolver-side Elemental Shielding protection for one classified aura event. */
export function applyResolverElementalShielding(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.ELEMENTAL_SHIELDING)) return;
  const protection = elementalShieldingEffect(context);
  if (!protection) return;
  context.effects.emit({
    kind: 'packet',
    durationContext: event,
    event: {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.ELEMENTAL_SHIELDING,
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SHIELDING).name,
      kind: protection.kind.toLowerCase(),
      stacks: protection.stacks,
      duration: protection.duration,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    }
  });
}

/** Preserve the live earth attribute pass at its original position in the Core modifier pipeline. */
export function reconcileSignetPassive(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  if (
    hasSelectedSkillId(context, ID.SIGNET_OF_FIRE) &&
    !hasTrait(context, TRAIT.WRITTEN_IN_STONE) &&
    context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_FIRE, context.time)
  ) {
    const signetOfFireProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFire);
    modified.precision = (modified.precision || 0) - balanceProfileNumber(signetOfFireProfile, 'attributeBonus');
  }
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function geomancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Earth' && hasTrait(context, TRAIT.GEOMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GEOMANCERS_TRAINING), 'rechargeMultiplier')
    : duration;
}

/** Grants Pyromancer's Puissance might after an in-combat Fire-attuned cast. */
export function applyPyromancersPuissance(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const at = cast.effectiveEnd;
  if (
    !hasTrait(context, TRAIT.PYROMANCERS_PUISSANCE) ||
    professionCoreState(context).primaryAttunement !== 'Fire' ||
    !combatStarted(context, at)
  )
    return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.PYROMANCERS_PUISSANCE,
      'Attunement Might',
      skill.name,
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Applies Smothering Auras' profile-driven duration multiplier once. */
export function elementalistAuraDuration(context: unknown, duration: number): number {
  return hasTrait(context, TRAIT.SMOTHERING_AURAS)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SMOTHERING_AURAS), 'durationMultiplier')
    : duration;
}

/** Conjurer grants its aura between bundle creation and the resulting swap events. */
export function applyConjurerAura(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  const at = cast.effectiveEnd;
  if (hasTrait(context, TRAIT.CONJURER)) {
    const conjurerProfile = requireBalanceProfileFromContext(context, TRAIT.CONJURER);
    const conjurerBuff = requireEffect(conjurerProfile, 'buff', 'Conjurer');
    if (conjurerBuff) {
      applyAura(context, {
        at,
        aura: String(conjurerBuff.kind),
        duration: conjurerBuff.duration,
        skillName: 'Conjurer',
        sourceId: skill.id
      });
    }
  }
}

/** Preserve the live fire attribute pass at its original position in the Core modifier pipeline. */
export function applyFireTraitAttributes(context: ElementalistModifierContext, modified: Gw2MutableStats): void {
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.EMPOWERING_FLAME) && primary === 'Fire') {
    const empoweringFlameProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_FLAME);
    modified.power = (modified.power || 0) + balanceProfileNumber(empoweringFlameProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.POWER_OVERWHELMING) &&
    elementalistMightStacks(context) >=
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING), 'minimumStacks')
  ) {
    const powerOverwhelmingProfile = requireBalanceProfileFromContext(context, TRAIT.POWER_OVERWHELMING);
    modified.power =
      (modified.power || 0) +
      (primary === 'Fire'
        ? balanceProfileNumber(powerOverwhelmingProfile, 'weaponAttributeBonus')
        : balanceProfileNumber(powerOverwhelmingProfile, 'attributeBonus'));
  }
}

/** Inferno converts final Power only for its Burning packets at condition-attribute evaluation. */
export function applyInfernoAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  return powerScaledConditionAttributes(context, attributes, 'Burning', TRAIT.INFERNO);
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function pyromancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Fire' && hasTrait(context, TRAIT.PYROMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}

/** Applies Soothing Ice's Frost Aura and regeneration from an eligible healing skill. */
export function applySoothingIce(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  const at = cast.effectiveEnd;
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.SOOTHING_ICE)) {
    return;
  }

  const soothingIceProfile = requireBalanceProfileFromContext(context, TRAIT.SOOTHING_ICE);
  // Claim the existing owner-local timer before any derived effect.
  if (!context.procs.claimCooldown('soothingIce', at, balanceProfileNumber(soothingIceProfile, 'internalCooldown')))
    return;
  const soothingIceFrostAura = requireEffect(soothingIceProfile, 'buff', 'Frost Aura');
  if (soothingIceFrostAura) {
    applyAura(context, {
      at,
      aura: String(soothingIceFrostAura.kind),
      duration: soothingIceFrostAura.duration,
      skillName: 'Soothing Ice',
      sourceId: skill.id
    });
  }

  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.SOOTHING_ICE,
      'Regeneration',
      'Soothing Ice',
      skill.id,
      undefined,
      undefined,
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Scale this element's weapon recharge after the mechanic has handled held and non-weapon cooldowns. */
export function aquamancersTrainingRecharge(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  duration: number
): number {
  return skill.attunement === 'Water' && hasTrait(context, TRAIT.AQUAMANCERS_TRAINING)
    ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.AQUAMANCERS_TRAINING),
          'rechargeMultiplier'
        )
    : duration;
}
