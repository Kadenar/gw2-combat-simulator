import { professionStaticRulesApplied } from '../../../../platform/gw2/attribute-provenance.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import {
  emitBuff,
  gainNecromancerLifeForce,
  hasTrait as hasNecromancerTrait,
  necromancerPartyBoonRecipients
} from '../../core/shared.js';
import { advanceHarbingerBlight } from './blight.js';
import { harbingerState } from './state.js';
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerCriticalExpectedFactor,
  necromancerRuntimeSpecializationState,
  necromancerTargetHasCondition
} from '../../core/rules.js';
import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type {
  NecromancerRechargeModifierContext,
  NecromancerSimulationEvent,
  NecromancerCastContext,
  NecromancerSkill
} from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function afterCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = harbingerState.from(context);
  const at = context.effectiveEnd;
  // Advance blight ticks that elapsed during the cast before checking entrance bonuses.
  advanceHarbingerBlight(context, at);
  if (skill.id === ID.HARBINGER_SHROUD && professionCoreState(context).activeShroud === 'harbinger') {
    // Reset the per-second cursor to the next whole second so blight ticks don't accumulate a fractional offset over time.
    state.nextBlightAt = Math.floor(at) + 1;
    if (hasNecromancerTrait(context, TRAIT.CORRUPTED_TALENT)) {
      gainNecromancerLifeForce(
        context,
        Number(necromancerBalanceProfile(context, PROFILE.corruptedTalent)?.lifeForceGain || 15),
        at
      );
    }

    if (hasNecromancerTrait(context, TRAIT.DEATHLY_HASTE)) {
      const profile = necromancerBalanceProfile(context, PROFILE.deathlyHaste);
      const quickness = balanceProfileEffect(profile, 'boon');
      const fury = balanceProfileEffect(profile, 'boon', 1);
      const recipients = necromancerPartyBoonRecipients(context);
      emitBuff(
        context,
        skill,
        String(quickness?.boon || 'quickness'),
        Number(quickness?.duration || 4),
        Number(quickness?.stacks || 1),
        {
          metadata: recipients
        }
      );
      emitBuff(context, skill, String(fury?.boon || 'fury'), Number(fury?.duration || 4), Number(fury?.stacks || 1), {
        metadata: recipients
      });
    }

    if (hasNecromancerTrait(context, TRAIT.IMPLACABLE_FOE)) {
      const profile = necromancerBalanceProfile(context, PROFILE.implacableFoe);
      const stability = balanceProfileEffect(profile, 'boon');
      const buff = balanceProfileEffect(profile, 'buff');
      emitBuff(
        context,
        skill,
        String(stability?.boon || 'stability'),
        Number(stability?.duration || 5),
        Number(stability?.stacks || 3)
      );
      emitBuff(
        context,
        skill,
        String(buff?.kind || 'implacable-foe'),
        Number(buff?.duration || 2),
        Number(buff?.stacks || 1)
      );
    }
  }

  if (skill.id === ID.DARK_BARRAGE && hasNecromancerTrait(context, TRAIT.DEATHLY_HASTE)) {
    const profile = necromancerBalanceProfile(context, PROFILE.deathlyHaste);
    const quickness = balanceProfileEffect(profile, 'boon');
    const fury = balanceProfileEffect(profile, 'boon', 1);
    const deathlyHaste = {
      source: 'Trait',
      sourceId: TRAIT.DEATHLY_HASTE,
      ...necromancerPartyBoonRecipients(context)
    };
    emitBuff(
      context,
      skill,
      String(quickness?.boon || 'quickness'),
      Number(quickness?.duration || 4),
      Number(quickness?.stacks || 1),
      { at, metadata: deathlyHaste }
    );
    emitBuff(context, skill, String(fury?.boon || 'fury'), Number(fury?.duration || 4), Number(fury?.stacks || 1), {
      at,
      metadata: deathlyHaste
    });
  }
}

export const harbingerSchedulerHooks = Object.freeze({
  // order: -10 ensures Harbinger blight advances before any profession-agnostic advance hooks run.
  advance: {
    id: 'harbinger.advance-blight',
    order: -10,
    handler: advanceHarbingerBlight
  },
  afterCast: {
    id: 'harbinger.after-cast',
    order: -10,
    handler: afterCast
  }
});

function modifyHarbingerAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config)) {
    // Alchemic Vigor is the minor adept trait; the specialization check lets it apply even when only the
    // spec is selected without the trait being explicitly listed (e.g. from the specialization line bonus).
    if (context.config?.specialization === 'Harbinger' || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)) {
      result.vitality += Number(necromancerBalanceProfile(context, PROFILE.alchemicVigor)?.attributeBonus || 240);
    }

    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      result.ferocity +=
        result.vitality *
        Number(necromancerBalanceProfile(context, PROFILE.implacableFoe)?.attributeConversion || 0.13);
    }

    if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
      result.concentration +=
        result.vitality *
        Number(necromancerBalanceProfile(context, PROFILE.twistedMedicine)?.attributeConversion || 0.13);
    }

    if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
      // Alchemic Vigor and other flat Vitality bonuses precede conversion.
      result.expertise += Math.round(
        result.vitality * Number(necromancerBalanceProfile(context, PROFILE.darkGunslinger)?.attributeConversion || 0.1)
      );
    }
  }

  return result;
}

function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event as NecromancerSimulationEvent | undefined;
  // Prefer the snapshotted blight from the event so that modifier rules see the value at the moment of impact,
  // not the current (post-impact) blight count which may already be lower due to subsequent consumption.
  return Math.max(0, Number(event?.necromancerBlight ?? necromancerRuntimeSpecializationState(context).blight ?? 0));
}

function wickedCorruptionCriticalFactor(
  context: Gw2ModifierContext,
  parameters: Readonly<Record<string, number>>
): number {
  const deathPerceptionActive = hasTrait(context, TRAIT.DEATH_PERCEPTION) && Boolean(necromancerActiveShroud(context));
  // Death Perception already contributes a 10% crit-chance bonus in shroud; Wicked Corruption adds another 10%.
  // To avoid double-counting, compute the combined factor (1.21) and divide out the Death Perception factor (1.1).
  const coreFactor = deathPerceptionActive
    ? necromancerCriticalExpectedFactor(context, parameters.deathPerceptionCriticalHitFactor)
    : 1;
  const combinedFactor = necromancerCriticalExpectedFactor(
    context,
    deathPerceptionActive ? parameters.combinedCriticalHitFactor : parameters.criticalHitFactor
  );
  return combinedFactor / coreFactor;
}

function modifyHarbingerRechargeDuration(context: NecromancerRechargeModifierContext, duration: number): number {
  return context.skill?.weapon === 'Pistol' && hasTrait(context, TRAIT.DARK_GUNSLINGER)
    ? duration * Number(necromancerBalanceProfile(context, PROFILE.darkGunslinger)?.rechargeMultiplier || 0.8)
    : duration;
}

export const harbingerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
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
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      criticalHitFactor: 1.1,
      deathPerceptionCriticalHitFactor: 1.1,
      combinedCriticalHitFactor: 1.21
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => wickedCorruptionCriticalFactor(context, parameters),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WICKED_CORRUPTION) && necromancerTargetHasCondition(context, 'Torment')
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
      Number(necromancerRuntimeSpecializationState(context).meltdownUntil || 0) > context.time
  }
]);

export const harbingerAttributeRules = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes,
  modifierRules: harbingerModifierRules
});

export const harbingerCastRules = Object.freeze({
  modifyRechargeDuration: modifyHarbingerRechargeDuration
});
