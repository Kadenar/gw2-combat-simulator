import type { Gw2Stats, Gw2MutableStats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  eventSkill,
  hasSelectedSkill,
  targetConditionActive,
  targetConditionCount,
  targetHealthBelow,
  vulnerabilityStacks
} from '#gw2/platform/combat/query/runtime-query.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { necromancerCastRules } from '#gw2/professions/necromancer/core/mechanics/availability.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  NecromancerSkillModifierContext,
  NecromancerSkill,
  NecromancerState
} from '#gw2/professions/necromancer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';

/** Reads Core Necromancer state from a resolver-side modifier context. */
function necromancerRuntimeCoreState(context: Gw2ModifierContext): Partial<NecromancerCoreState> {
  return readProfessionCoreState<NecromancerCoreState>(context.runtime?.profession);
}

/** Reads the expected Necromancer specialization state from a resolver-side modifier context. */
export function necromancerRuntimeSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<NecromancerState> {
  return readProfessionSpecializationState<NecromancerState>(context.runtime?.profession, expectedKind) || {};
}

/** Resolves the active modifier event's Necromancer-specific skill metadata. */
export function necromancerEventSkill(context: Gw2ModifierContext): NecromancerSkill | undefined {
  return eventSkill<NecromancerSkill>(context);
}

/** Returns the active Necromancer shroud identifier, or an empty string outside shroud. */
export function necromancerActiveShroud(context: Gw2ModifierContext): string {
  return String(necromancerRuntimeCoreState(context).activeShroud || '');
}

/** Reports permanent or runtime Chilled target state at modifier evaluation time. */
export function necromancerTargetChilled(context: Gw2ModifierContext): boolean {
  return (
    targetConditionActive(context, 'Chilled') ||
    Number(necromancerRuntimeCoreState(context).targetChilledUntil || 0) > context.time
  );
}

/** Reports whether target assumptions or a live non-defiant control window make the target controlled. */
export function necromancerTargetControlled(context: Gw2ModifierContext): boolean {
  return (
    Boolean(context.config?.target?.controlled) ||
    (context.config?.target?.defiant !== true &&
      Number(necromancerRuntimeCoreState(context).targetControlledUntil || 0) > context.time)
  );
}

/** Clones mutable combat attributes with the numeric fields used by Necromancer conversions. */
export function cloneNecromancerAttributes(attributes: Gw2Stats): Gw2MutableStats & {
  power: number;
  precision: number;
  vitality: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  concentration: number;
} {
  return { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    vitality: number;
    ferocity: number;
    conditionDamage: number;
    expertise: number;
    concentration: number;
  };
}

/** Checks whether Signet of Spite's selected, out-of-shroud, off-cooldown passive is active. */
function signetOfSpitePassiveActive(context: Gw2ModifierContext): boolean {
  return (
    hasSelectedSkill(context, 'Signet of Spite') &&
    !necromancerActiveShroud(context) &&
    !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_SPITE, context.time)
  );
}

/** Restricts player attributes and outgoing modifiers to player-owned contexts. */
function playerModifierContext(context: Gw2ModifierContext): boolean {
  // Eventless attribute queries describe the player; event queries follow explicit outgoing ownership.
  return context.event
    ? isGw2PlayerModifierOwnedEvent(context.event)
    : context.actorType == null || context.actorType === 'player';
}

/** Applies Core Necromancer static conversions and runtime-dependent attribute bonuses. */
export function modifyNecromancerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  // Conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's power/condition damage) and live trait bonuses
  // (accrued on `result`).
  const gearPower = Number(context.config?.stats?.power || 0);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasSelectedSkill(context, 'Signet of Spite')) {
    const signetOfSpiteProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfSpite);
    const signetPower = balanceProfileNumber(signetOfSpiteProfile, 'attributeBonus');
    const passiveActive = playerModifierContext(context) && signetOfSpitePassiveActive(context);
    if (staticRulesApplied) {
      if (!passiveActive) result.power -= signetPower;
    } else if (passiveActive) {
      result.power += signetPower;
    }
  }

  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedCarapace = activeStackCount(necromancerRuntimeCoreState(context).carapaceExpiries || [], context.time);
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(necromancerRuntimeCoreState(context).activeMinions || {}).reduce(
        (total: number, count: number) =>
          total +
          Number(count || 0) *
            balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.fleshOfTheMaster), 'resourceGain'),
        0
      )
    : 0;
  const carapace = Math.min(
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.fleshOfTheMaster), 'maximumStacks'),
    timedCarapace + minionCarapace
  );
  if (hasTrait(context, TRAIT.DEADLY_STRENGTH) && carapace > 0) {
    const deadlyStrengthProfile = requireBalanceProfileFromContext(context, PROFILE.deadlyStrength);
    const perStack = balanceProfileNumber(deadlyStrengthProfile, 'attributePerStack');
    result.power += carapace * perStack;
    result.conditionDamage += carapace * perStack;
  }

  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    const awakenThePainProfile = requireBalanceProfileFromContext(context, PROFILE.awakenThePain);
    const perStack = balanceProfileNumber(awakenThePainProfile, 'attributePerStack');
    result.power += Number(context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) * perStack;
  }

  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
      const spitefulFortitudeProfile = requireBalanceProfileFromContext(context, PROFILE.spitefulFortitude);
      result.vitality += gearPower * balanceProfileNumber(spitefulFortitudeProfile, 'attributeConversion');
    }

    if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
      const furiousDemiseProfile = requireBalanceProfileFromContext(context, PROFILE.furiousDemise);
      result.precision += balanceProfileNumber(furiousDemiseProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
      const targetTheWeakProfile = requireBalanceProfileFromContext(context, PROFILE.targetTheWeak);
      // Flat Precision from Furious Demise is present before the conversion.
      result.conditionDamage += Math.floor(
        result.precision * balanceProfileNumber(targetTheWeakProfile, 'attributeConversion')
      );
    }

    if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
      const lingeringCurseProfile = requireBalanceProfileFromContext(context, PROFILE.lingeringCurse);
      result.conditionDamage += balanceProfileNumber(lingeringCurseProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) {
      const vitalPersistenceProfile = requireBalanceProfileFromContext(context, PROFILE.vitalPersistence);
      result.vitality += balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus');
    }
  }

  return result;
}

const necromancerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.life-siphon-bleeding-target',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      Boolean(necromancerEventSkill(context)?.id === ID.LIFE_SIPHON && targetConditionActive(context, 'Bleeding'))
  },
  {
    id: 'necromancer.target-the-weak-critical-chance',
    label: 'Target the Weak',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',

    amount: (context) =>
      targetConditionCount(context) *
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.TARGET_THE_WEAK),
        'criticalChancePerCondition'
      ),
    when: (context) => hasTrait(context, TRAIT.TARGET_THE_WEAK)
  },
  {
    id: 'necromancer.death-perception-critical-chance',
    label: 'Death Perception',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.DEATH_PERCEPTION)
  },
  {
    id: 'necromancer.soul-barbs',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      Boolean(
        hasTrait(context, TRAIT.SOUL_BARBS) && context.timeline?.timedActive('necromancer-soul-barbs', context.time)
      )
  },
  {
    id: 'necromancer.dread',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      hasTrait(context, TRAIT.DREAD) && Number(necromancerRuntimeCoreState(context).dreadUntil || 0) > context.time
  },
  {
    id: 'necromancer.death-perception-critical-hit-damage',
    // Apply critical-only bonuses at their source so previews and expected strike damage agree.
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',

    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalDamage'),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.DEATH_PERCEPTION) && Boolean(necromancerActiveShroud(context))
  },
  {
    id: 'necromancer.spiteful-talisman',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // The target never has boons, so the full bonus always applies.
    factor: 1.05,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.SPITEFUL_TALISMAN)
  },
  {
    id: 'necromancer.close-to-death',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.CLOSE_TO_DEATH) && targetHealthBelow(context, 0.5)
  },
  {
    // Ghastly Claws' own Vulnerability bonus multiplies the target's ordinary Vulnerability multiplier.
    id: 'necromancer.ghastly-claws-vulnerability',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) => 1 + vulnerabilityStacks(context) * 0.01,
    when: (context) => context.event?.skillId === ID.GHASTLY_CLAWS && context.event.actorType === 'player'
  },
  {
    id: 'necromancer.necromantic-corruption',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      Boolean(context.event?.summonKind === 'minion' && hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION))
  },
  {
    id: 'necromancer.putrid-defense',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => context.condition === 'Poisoned' && hasTrait(context, TRAIT.PUTRID_DEFENSE)
  },
  {
    id: 'necromancer.barbed-precision-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION),
        'conditionDurationMultiplier'
      ),
    when: (context) =>
      context.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.BARBED_PRECISION) &&
      !professionStaticRulesApplied(context.config)
  }
]);

/** Applies Core skill-family recharge traits while preserving minion-death recharge exceptions. */
function modifyNecromancerCoreRechargeDuration(context: NecromancerSkillModifierContext, duration: number): number {
  let result = duration;
  const skill = context.skill;
  if (skill?.rechargeOnMinionDeath && !context.minionDeathRecharge) return 0;
  if (skill?.categories?.includes('Corruption') && hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)) {
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_CORRUPTION),
      'rechargeMultiplier'
    );
  }

  if ((skill?.shroud || skill?.handlerId === 'necromancer.shade') && hasTrait(context, TRAIT.SINISTER_SHROUD)) {
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.sinisterShroud),
      'rechargeMultiplier'
    );
  }

  return result;
}

/** Extends eligible scepter condition base durations for Lingering Curse. */
function modifyNecromancerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  return necromancerEventSkill(context)?.weapon === 'Scepter' &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.lingeringCurse), 'durationMultiplier')
    : duration;
}

/** Aligns Isolate's recharge start to the cast progress where its flip activates. */
function modifyNecromancerRechargeStart(
  context: {
    readonly skill?: NecromancerSkill;
    readonly start: number;
  },
  rechargeStart: number
): number {
  if (context.skill?.id !== ID.ISOLATE || context.skill.flipActivationAtMs == null) return rechargeStart;
  const baseCastMs = Number(context.skill.castTimeMs || 0);
  const activationProgress = baseCastMs > 0 ? Number(context.skill.flipActivationAtMs) / baseCastMs : 1;
  return context.start + (rechargeStart - context.start) * activationProgress;
}

export const necromancerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyNecromancerCoreAttributes,
  modifyConditionBaseDuration: modifyNecromancerConditionBaseDuration,
  modifierRules: necromancerCoreModifierRules,
  compileModifierRules: compileGw2ModifierRules
});

export const necromancerCoreCastRules = Object.freeze({
  ...necromancerCastRules,
  modifyRechargeDuration: modifyNecromancerCoreRechargeDuration,
  modifyRechargeStart: modifyNecromancerRechargeStart
});
