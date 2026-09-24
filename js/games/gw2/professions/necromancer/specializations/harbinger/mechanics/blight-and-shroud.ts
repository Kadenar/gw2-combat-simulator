import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gainNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import {
  advanceHarbingerBlight,
  harbingerBlightTaskHandlers,
  emitBlightState
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/traits/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  NecromancerSkillModifierContext,
  NecromancerSimulationEvent,
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';

/** Seeds initial Blight and registers its shroud-exit cursor cleanup. */
function initializeHarbingerRuntime(context: NecromancerSchedulerContext): void {
  // Direct simulation configs still need Alchemic Vigor in the display conversion; the percentage pool is unchanged.
  if (!professionStaticRulesApplied(context.config)) {
    const vitality =
      Number(context.config.stats?.vitality ?? 1000) +
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.alchemicVigor), 'attributeBonus');
    professionCoreState(context).lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(
      {
        ...context.config,
        stats: { ...context.config.stats, vitality }
      },
      context
    );
  }

  // Seed the chart before the first cast so initial Blight contributes throughout the observation window.
  emitBlightState(context, harbingerState.from(context), context.state.time);
  registerNecromancerShroudLifecycle(context, 'harbinger.shroud', {
    onEnter: enterHarbingerShroud,
    onExit: (runtime) => {
      harbingerState.from(runtime).nextBlightAt = Number.POSITIVE_INFINITY;
    }
  });
}

/** Shares Deathly Haste grants while retaining the triggering skill's completion time and attribution. */
function emitDeathlyHaste(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  attribution: { source?: string; sourceId?: NecromancerSkill['id'] } = {}
): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.deathlyHaste);
  // Each named boon is independent, so removing one keeps its sibling bound to its own values.
  for (const name of ['quickness', 'fury']) {
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) continue;
    emitSkillBuff(context, skill, {
      at: context.state.time,
      kind: String(effect.boon),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: { recipients: 'party', maximumRecipients: 5 },
      ...attribution
    });
  }
}

/** Entry gains commit with the transform, before an empty life-force pool can trigger depletion. */
function enterHarbingerShroud(context: NecromancerSchedulerContext, skill: NecromancerSkill): void {
  const state = harbingerState.from(context);
  const at = context.state.time;
  if (skill.id === ID.HARBINGER_SHROUD && professionCoreState(context).activeShroud === 'harbinger') {
    // Reset the per-second cursor to the next whole second so blight ticks don't accumulate a fractional offset over time.
    state.nextBlightAt = Math.floor(at) + 1;
    if (hasTrait(context, TRAIT.CORRUPTED_TALENT)) {
      gainNecromancerLifeForce(
        context,
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.corruptedTalent), 'lifeForceGain'),
        at
      );
    }

    if (hasTrait(context, TRAIT.DEATHLY_HASTE)) emitDeathlyHaste(context, skill);

    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.implacableFoe);
      // Stability and the Implacable Foe status are independent entry outputs.
      for (const effect of [
        requireEffect(profile, 'boon', 'stability'),
        requireEffect(profile, 'buff', 'implacable-foe')
      ]) {
        if (!effect) continue;
        emitSkillBuff(context, skill, {
          at,
          kind: String(effect.boon ?? effect.kind),
          duration: effectNumber(profile, effect, 'duration'),
          stacks: effectNumber(profile, effect, 'stacks')
        });
      }
    }
  }
}

export const harbingerSchedulerHooks = Object.freeze({
  initialize: {
    id: 'harbinger.initialize-runtime',
    order: 10,
    handler: initializeHarbingerRuntime
  },
  // order: -10 ensures Harbinger blight advances before any profession-agnostic advance hooks run.
  advance: {
    id: 'harbinger.advance-blight',
    order: -10,
    handler: advanceHarbingerBlight
  },
  onCastComplete: {
    id: 'harbinger.complete-cast',
    order: -10,
    handler: (context: NecromancerCastContext, skill: NecromancerSkill) => {
      if (!context.action.cancelled && skill.id === ID.DARK_BARRAGE && hasTrait(context, TRAIT.DEATHLY_HASTE)) {
        emitDeathlyHaste(context, skill, { source: 'Trait', sourceId: TRAIT.DEATHLY_HASTE });
      }
    }
  },
  taskHandlers: harbingerBlightTaskHandlers
});

/** Applies Harbinger vitality and vitality-derived conversions when the build layer has not. */
function modifyHarbingerAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config)) {
    // Alchemic Vigor is the minor adept trait; the specialization check lets it apply even when only the
    // spec is selected without the trait being explicitly listed (e.g. from the specialization line bonus).
    if (context.config?.specialization === 'Harbinger' || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)) {
      const alchemicVigorProfile = requireBalanceProfileFromContext(context, PROFILE.alchemicVigor);
      result.vitality += balanceProfileNumber(alchemicVigorProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      const implacableFoeProfile = requireBalanceProfileFromContext(context, PROFILE.implacableFoe);
      result.ferocity += result.vitality * balanceProfileNumber(implacableFoeProfile, 'attributeConversion');
    }

    if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
      const twistedMedicineProfile = requireBalanceProfileFromContext(context, PROFILE.twistedMedicine);
      result.concentration += result.vitality * balanceProfileNumber(twistedMedicineProfile, 'attributeConversion');
    }

    if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
      const darkGunslingerProfile = requireBalanceProfileFromContext(context, PROFILE.darkGunslinger);
      // Alchemic Vigor and other flat Vitality bonuses precede conversion.
      result.expertise += Math.round(
        result.vitality * balanceProfileNumber(darkGunslingerProfile, 'attributeConversion')
      );
    }
  }

  return result;
}

/** Reads event-snapshotted Blight before falling back to current Harbinger runtime state. */
function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event as NecromancerSimulationEvent | undefined;
  // Prefer the snapshotted blight from the event so that modifier rules see the value at the moment of impact,
  // not the current (post-impact) blight count which may already be lower due to subsequent consumption.
  return Math.max(
    0,
    Number(
      event?.metadata?.necromancerBlight ?? necromancerRuntimeSpecializationState(context, 'Harbinger').blight ?? 0
    )
  );
}

/** Applies Dark Gunslinger's pistol recharge reduction. */
function modifyHarbingerRechargeDuration(context: NecromancerSkillModifierContext, duration: number): number {
  return context.skill?.weapon === 'Pistol' && hasTrait(context, TRAIT.DARK_GUNSLINGER)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.darkGunslinger), 'rechargeMultiplier')
    : duration;
}

const harbingerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.wicked-corruption-blight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION)
  },
  {
    id: 'necromancer.wicked-corruption-critical-hit-damage',
    // Multiplying critical damage directly also composes with Death Perception exactly once.
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',

    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WICKED_CORRUPTION), 'criticalDamage'),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION) && targetConditionActive(context, 'Torment')
  },
  {
    id: 'necromancer.septic-corruption-blight',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: { damagePerStack: 0.0025 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.SEPTIC_CORRUPTION)
  },
  {
    id: 'necromancer.cascading-corruption',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // 10% bonus applies only during the 10 s Meltdown window; meltdownUntil is set/cleared in applyCascadingCorruption.
    when: (context) =>
      hasTrait(context, TRAIT.CASCADING_CORRUPTION) &&
      Number(necromancerRuntimeSpecializationState(context, 'Harbinger').meltdownUntil || 0) > context.time
  }
]);

export const harbingerAttributeRules = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes,
  modifierRules: harbingerModifierRules
});

export const harbingerCastRules = Object.freeze({
  modifyRechargeDuration: modifyHarbingerRechargeDuration
});
