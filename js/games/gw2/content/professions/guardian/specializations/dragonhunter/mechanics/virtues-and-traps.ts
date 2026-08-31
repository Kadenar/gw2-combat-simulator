import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { guardianTargetDisabled } from '#gw2/content/professions/guardian/core/traits/modifiers.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/content/professions/guardian/types.js';
import { dragonhunterState } from '#gw2/content/professions/guardian/specializations/dragonhunter/state.js';

import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/dragonhunter/profiles.js';

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

export function advanceDragonhunterState(context: GuardianSchedulerContext, target: number): void {
  const state = dragonhunterState.from(context);
  // Indomitable Courage reduces passive Aegis interval: 40s → 30s.
  const interval = hasTrait(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
    ? Number(balanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)?.pulseInterval || 30)
    : Number(balanceProfileFromContext(context, PROFILE.passiveCourage)?.pulseInterval || 40);
  const aegis = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.passiveCourage), 'boon');
  const courage = context.catalog.skillsById.get(ID.SHIELD_OF_COURAGE);
  while (courage && state.nextShieldOfCourageAegisAt <= target + context.epsilon) {
    const at = state.nextShieldOfCourageAegisAt;
    // Passive Aegis is suppressed while the virtue's cooldown hasn't expired;
    // activating Shield of Courage resets virtueReadyAt.courage, so pulses during
    // the active period are silently skipped (counter still advances to stay in phase).
    if (at >= Number(professionCoreState(context).virtueReadyAt.courage || 0) - context.epsilon) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: courage.id,
        actorType: 'player',
        skillId: courage.id,
        skillName: courage.name,
        name: 'Shield of Courage — Passive Aegis',
        kind: 'aegis',
        stacks: Number(aegis?.stacks || 1),
        duration: gw2SchedulerBoonDuration(context, courage, 'aegis', Number(aegis?.duration || 20))
      });
    }

    state.nextShieldOfCourageAegisAt += interval;
  }
}

export function updateDragonhunterCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  if (skill.slot === 'Elite' && hasTrait(context, GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION)) {
    const core = professionCoreState(context);
    // Endurance is applied directly to scheduler state (not via an emit) so
    // the dodge-availability check sees it immediately on the same advance tick.
    const endurance = Number(balanceProfileFromContext(context, PROFILE.huntersDetermination)?.resourceGain || 100);
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
    const aegis = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.huntersPremonition), 'boon');
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'aegis',
      duration: Number(aegis?.duration || 3),
      stacks: 1
    });
  }
}

/** Runs Dragonhunter mechanics owned by one completed skill activation. */
export const dragonhunterSkillMechanicHandlers = Object.freeze({
  'guardian.dragonhunter.arm-hunters-verdict': ({ context }: { context: GuardianSchedulerContext }): void => {
    // Hunter's Verdict remains available only while Spear of Justice's tether is active.
    professionCoreState(context).availableFlips[ID.HUNTERS_VERDICT] = dragonhunterState.from(context).tetherUntil;
  }
});

export const dragonhunterSchedulerHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: 'guardian.dragonhunter.passive-courage',
      order: 40,
      handler: advanceDragonhunterState
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
