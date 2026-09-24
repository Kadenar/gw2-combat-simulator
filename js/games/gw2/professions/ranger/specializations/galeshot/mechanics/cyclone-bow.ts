import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { grantResource } from '#gw2/platform/combat/resources/resource-policy.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';

import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';

const MISSILE_SKILL_IDS = new Set<number>([
  ID.RICOCHET,
  ID.SPLITBLADE,
  ID.WINTERS_BITE,
  ID.PATH_OF_SCARS,
  ID.PATH_OF_SCARS_MAX_RANGE,
  ID.RAPID_FIRE,
  ID.LONG_RANGE_SHOT,
  ID.POINT_BLANK_SHOT,
  ID.HUNTERS_SHOT,
  ID.KEEN_SHOT,
  ID.HAWKEYE,
  ID.BLUSTER,
  ID.FLEETING_ZEPHYR,
  ID.QUARRYS_PERIL,
  ID.PELT,
  ID.SUPERSONIC_ARROW,
  ID.PIERCING_GALES
]);

export function observeGaleshotEvent(context: RangerSchedulerContext, event: SimulationEvent): void {
  if (event.type === 'ranger.pet-swapped') {
    // Wuthering Wind targets the active pet; an unconsumed charge is lost on
    // swap rather than transferring to the incoming pet.
    galeshotState.from(context).wutheringWindReady = false;
  }

  galeshotMissileReaction.onEventScheduled.handler(context, event);
  galeshotPetReaction.onEventScheduled.handler(context, event);
  galeshotDisableReaction.onEventScheduled.handler(context, event);
}

/** Capture impact identity while evaluating current Galeshot state at execution. */
export const galeshotMissileReaction = scheduledReaction<
  RangerSchedulerContext,
  SimulationEvent,
  {
    readonly skillName: SimulationEvent['skillName'];
  }
>({
  id: 'ranger.galeshot-missile-hit',
  select(_context, event) {
    if (
      event.type === 'damage' &&
      event.actorType === 'player' &&
      Number(event.coefficient) > 0 &&
      MISSILE_SKILL_IDS.has(Number(event.skillId ?? event.sourceId))
    ) {
      return {
        at: event.at,
        priority: -40,
        payload: {
          skillName: event.skillName
        }
      };
    }

    return null;
  },
  execute(context, at, payload) {
    const state = galeshotState.from(context);
    // An armed Mistral includes missiles landing at expiry; zero never arms it.
    if (state.mistralUntil > 0 && at <= state.mistralUntil) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.mistral);
      const strike = requireEffect(profile, 'strike', 'Strike');
      const chilled = requireEffect(profile, 'condition', 'Chilled');
      // Each missile-triggered Mistral is its own effect activation while its
      // strike and condition packets remain grouped under one identity.
      const activationId = strike || chilled ? context.createActivationId('effect') : undefined;
      if (strike)
        emitSkillDamage(context, {
          at: at,
          source: 'ranger',
          sourceId: ID.MISTRAL,
          actorType: 'player',
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral',
          coefficient: effectNumber(profile, strike, 'coefficient'),
          hits: effectNumber(profile, strike, 'hits'),
          canCrit: true,
          damageKind: 'galeshot-mistral',
          triggeredBy: payload.skillName,
          activationId
        });
      if (chilled)
        emitSkillCondition(context, {
          at: at,
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral - Chilled',
          condition: String(chilled.condition),
          duration: effectNumber(profile, chilled, 'duration'),
          stacks: effectNumber(profile, chilled, 'stacks'),
          triggeredBy: payload.skillName,
          activationId
        });
    }

    if (!hasTrait({ config: context.config }, TRAIT.SHRIKE)) return;
    const profile = requireBalanceProfileFromContext(context, PROFILE.shrike);
    const threshold = balanceProfileNumber(profile, 'threshold');
    state.missileHits += 1;
    if (state.missileHits < threshold) return;
    // Subtract rather than reset so any overshoot from burst windows is preserved.
    state.missileHits -= threshold;
    // The arrow refund is independent of the strike, so it survives strike removal.
    grantResource(context, 'arrows', balanceProfileNumber(profile, 'resourceGain'));
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (!strike) return;
    const hits = effectNumber(profile, strike, 'hits');
    const coefficient = effectNumber(profile, strike, 'coefficient');
    for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
      emitSkillDamage(context, {
        at: at,
        source: 'Trait',
        sourceId: TRAIT.SHRIKE,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: TRAIT.SHRIKE,
        skillName: 'Shrike',
        name: 'Shrike',
        coefficient,
        hits: 1,
        hitIndex,
        totalHits: hits,
        canCrit: true,
        damageKind: 'galeshot-shrike',
        triggeredBy: payload.skillName
      });
    }
  }
});

/** Capture impact identity while evaluating current Galeshot state at execution. */
export const galeshotPetReaction = scheduledReaction<
  RangerSchedulerContext,
  SimulationEvent,
  {
    readonly skillName: SimulationEvent['skillName'];
    readonly activationId?: string;
  }
>({
  id: 'ranger.galeshot-pet-hit',
  select(_context, event) {
    if (
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.source === 'ranger-pet' &&
      Number(event.coefficient) > 0
    ) {
      return {
        at: event.at,
        priority: -40,
        payload: {
          skillName: event.skillName,
          activationId: event.activationId
        }
      };
    }

    return null;
  },
  execute(context, at, payload) {
    const state = galeshotState.from(context);
    const activationId = String(payload.activationId || '');
    if (
      !hasTrait({ config: context.config }, TRAIT.WUTHERING_WIND) ||
      !state.wutheringWindReady ||
      at + EPSILON < state.wutheringWindReadyAt ||
      (activationId && state.wutheringWindActivationIds[activationId])
    ) {
      return;
    }

    const profile = requireBalanceProfileFromContext(context, PROFILE.wutheringWind);
    const strike = requireEffect(profile, 'strike', 'Strike');
    // The primed charge and proc exist only for the strike, so a removed strike leaves the charge armed.
    if (!strike) return;
    state.wutheringWindReady = false;
    if (activationId) state.wutheringWindActivationIds[activationId] = true;
    context.emit({
      type: 'proc',
      at: at,
      source: 'Trait',
      sourceId: TRAIT.WUTHERING_WIND,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.WUTHERING_WIND,
      skillName: 'Wuthering Wind',
      name: 'Wuthering Wind',
      procType: 'trait',
      sourceSkill: payload.skillName,
      detail: 'activated'
    });
    emitSkillDamage(context, {
      at: at,
      source: 'Trait',
      sourceId: TRAIT.WUTHERING_WIND,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.WUTHERING_WIND,
      skillName: 'Wuthering Wind',
      name: 'Wuthering Wind',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits: effectNumber(profile, strike, 'hits'),
      canCrit: true,
      damageKind: 'galeshot-wuthering-wind',
      triggeredBy: payload.skillName,
      // Trait proc uses pet power scaling, not the player's weapon strength;
      // profession modifiers (e.g. Flock Together) still apply via the flags below.
      independentSummonStrike: true,
      summonUsesProfessionModifiers: true,
      summonBasePower: RANGER_PET_STRIKE_SCALING.basePower,
      summonBaseConditionDamage: RANGER_PET_STRIKE_SCALING.baseConditionDamage,
      summonInheritsCriticalAttributes: true
    });
  }
});

/** Capture impact identity while evaluating current Galeshot state at execution. */
export const galeshotDisableReaction = scheduledReaction<
  RangerSchedulerContext,
  SimulationEvent,
  Record<string, never>
>({
  id: 'ranger.galeshot-disable',
  select(_context, event) {
    if (event.type === 'control' && (event.actorType === 'player' || event.actorType === 'summon')) {
      return {
        at: event.at,
        priority: -40,
        payload: {}
      };
    }

    return null;
  },
  execute(context) {
    const state = galeshotState.from(context);
    if (
      !hasTrait({ config: context.config }, TRAIT.THRILL_OF_THE_CATCH) ||
      !isInternalCooldownReady(context.state.time, state.thrillOfTheCatchReadyAt)
    ) {
      return;
    }

    // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
    const profile = requireBalanceProfileFromContext(context, PROFILE.thrillOfTheCatch);
    state.thrillOfTheCatchReadyAt = context.state.time + balanceProfileNumber(profile, 'internalCooldown');
    grantResource(context, 'arrows', balanceProfileNumber(profile, 'resourceGain'));
  }
});

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(
    // petFamilySkills are passive and never cast by the player, so they don't
    // count. BEASTMODE / LEAVE_BEASTMODE are the mode-switch commands, not
    // actual pet abilities, so they're excluded as well.
    (skill.petSkill && !skill.petFamilySkill) ||
    (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
  );
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
export function completeGaleshotSkill(context: RangerCastContext, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (
    !hasTrait(context, TRAIT.FLOCK_TOGETHER) ||
    !isBeastSkill(skill) ||
    !isInternalCooldownReady(context.effectiveEnd, state.flockTogetherReadyAt)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.flockTogether);
  const quickness = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves it ready.
  if (!quickness) return;
  state.flockTogetherReadyAt = context.effectiveEnd + balanceProfileNumber(profile, 'internalCooldown');
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.FLOCK_TOGETHER,
    actorType: 'effect',
    skillId: TRAIT.FLOCK_TOGETHER,
    skillName: 'Flock Together',
    kind: String(quickness.boon),
    boon: String(quickness.boon),
    duration: gw2SchedulerBoonDuration(
      context,
      skill,
      String(quickness.boon),
      effectNumber(profile, quickness, 'duration')
    ),
    stacks: effectNumber(profile, quickness, 'stacks'),
    audience: { recipients: 'party' as const, maximumRecipients: 5 },
    triggeredBy: skill.name
  });
}
