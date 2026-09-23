import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianTargetDisabled } from '#gw2/professions/guardian/core/traits/modifiers.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { GuardianCastContext, GuardianSchedulerContext, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';

export const dragonhunterModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.dragonhunter.pure-of-sight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    order: 100,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.PURE_OF_SIGHT)
  },
  {
    id: 'guardian.dragonhunter.zealots-aggression',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_AGGRESSION) && targetConditionActive(context, 'Crippled')
  },
  {
    id: 'guardian.dragonhunter.heavy-light',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) && guardianTargetDisabled(context)
  },
  {
    id: 'guardian.dragonhunter.big-game-hunter',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    // Uses context.time (resolver clock), not event.at, because modifier rules
    // are evaluated at the moment damage resolves, not when it was scheduled.
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER) &&
      dragonhunterState.from(context).tetherUntil > context.time
  }
]);

export const dragonhunterAttributeRules = Object.freeze({
  modifierRules: dragonhunterModifierRules
});

function courageInterval(context: GuardianSchedulerContext): number {
  return hasTrait(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE),
        'pulseInterval'
      )
    : balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.passiveCourage), 'pulseInterval');
}

// Retain the passive cadence during dormancy; zero interval disables it entirely.
const shieldOfCourage = timedEffect<GuardianSchedulerContext, object>({
  id: 'guardian.dragonhunter.passive-courage',
  priority: -200,
  interval: courageInterval,
  effectsAt(context, at) {
    const passiveCourageProfile = requireBalanceProfileFromContext(context, PROFILE.passiveCourage);
    const aegis = requireEffect(passiveCourageProfile, 'boon', 'aegis');
    if (!aegis) return;
    const courage = context.catalog.skillsById.get(ID.SHIELD_OF_COURAGE);
    if (!courage) return false;
    // Passive Aegis is suppressed while the virtue's cooldown hasn't expired;
    // activating Shield of Courage resets virtueReadyAt.courage, so pulses during
    // the active period are silently skipped (counter still advances to stay in phase).
    if (at >= Number(professionCoreState(context).virtueReadyAt.courage || 0) - EPSILON) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: courage.id,
        actorType: 'player',
        skillId: courage.id,
        skillName: courage.name,
        name: 'Shield of Courage — Passive Aegis',
        kind: 'aegis',
        stacks: effectNumber(passiveCourageProfile, aegis, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          courage,
          'aegis',
          effectNumber(passiveCourageProfile, aegis, 'duration')
        )
      });
    }
  }
});

export function updateDragonhunterCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  if (skill.slot === 'Elite' && hasTrait(context, GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION)) {
    const core = professionCoreState(context);
    const huntersDeterminationProfile = requireBalanceProfileFromContext(context, PROFILE.huntersDetermination);
    // Endurance is applied directly to scheduler state (not via an emit) so
    // the dodge-availability check sees it immediately on the same advance tick.
    const endurance = balanceProfileNumber(huntersDeterminationProfile, 'resourceGain');
    Object.assign(core, grantEndurance(core, endurance, context.effectiveEnd, core.maximumEndurance));
    emitGuardianProc(context, {
      name: "Hunter's Determination",
      at: context.effectiveEnd,
      sourceSkill: skill.name,
      detail: `${endurance} endurance`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION)
    });
  }

  if (skill.categories?.includes('Trap') && hasTrait(context, GUARDIAN_TRAIT_IDS.HUNTERS_PREMONITION)) {
    // Hunter's Premonition fires on any trap cast, not just DH traps;
    // the "Trap" category tag on the skill definition is the only gate.
    const huntersPremonitionProfile = requireBalanceProfileFromContext(context, PROFILE.huntersPremonition);
    const aegis = requireEffect(huntersPremonitionProfile, 'boon', 'aegis');
    if (!aegis) return;
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'aegis',
      duration: effectNumber(huntersPremonitionProfile, aegis, 'duration'),
      stacks: 1
    });
  }
}

/** Runs Dragonhunter mechanics owned by one completed skill activation. */
export const dragonhunterSkillMechanicHandlers = Object.freeze({
  'guardian.dragonhunter.arm-hunters-verdict': ({
    context,
    at
  }: {
    context: GuardianSchedulerContext;
    at: number;
  }): void => {
    // Hunter's Verdict remains available only while Spear of Justice's tether is active.
    armSkillFlip(
      professionCoreState(context).availableFlips,
      ID.HUNTERS_VERDICT,
      at,
      canonicalTime(dragonhunterState.from(context).tetherUntil)
    );
  }
});

export const dragonhunterSchedulerHooks = Object.freeze({
  taskHandlers: shieldOfCourage.taskHandlers,
  initialize: Object.freeze([
    {
      id: 'guardian.dragonhunter.passive-courage',
      order: 40,
      handler: (context: GuardianSchedulerContext) => {
        if (courageInterval(context) > 0) shieldOfCourage.start(context, { at: 0, captured: {} });
      }
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.dragonhunter.traits',
      order: 40,
      handler: updateDragonhunterCastState
    }
  ])
});
