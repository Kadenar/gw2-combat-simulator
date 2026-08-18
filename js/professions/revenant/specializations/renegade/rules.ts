import { materializeSkillEffectApplications } from '../../../../platform/engine/effect-materializer.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { gw2AlliedPlayerAssumptions } from '../../../../platform/gw2/allied-players.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '../../data/ids.js';
import {
  revenantPlayer,
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState,
  revenantTargetHasCondition,
  revenantTimedBuff
} from '../../core/rules.js';
import { revenantCombatActive } from '../../core/legend.js';
import { emitLegendInvocationProfile, emitLegendInvocationSkill } from '../../core/legend-traits.js';
import { hasRevenantTrait } from '../../core/state.js';
import { grantKallasFervor } from './renegade.js';
import { RENEGADE_PROFILE_IDS, RENEGADE_SPIRIT_BOON_PROFILE_ID } from './skills.js';
import {
  handleRenegadeCriticalTraitsTask,
  initializeRenegadeTraits,
  modifyRenegadeCastDuration,
  modifyRenegadeRechargeDuration,
  observeRenegadeTraits,
  RENEGADE_CRITICAL_TRAITS_TASK
} from './traits.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../../types.js';

function kallasFervorStacks(context: Gw2ModifierContext): number {
  // Count only applications that have started (at ≤ time) and not yet expired (expiresAt > time)
  const state = revenantRuntimeSpecializationState(context);
  return Math.min(
    Math.max(1, Number(state.kallasFervorMaximumStacks)),
    (state.kallasFervor || []).filter(
      (application) => Number(application.at || 0) <= context.time && Number(application.expiresAt || 0) > context.time
    ).length
  );
}

export const renegadeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.heartpiercer-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.HEARTPIERCER) &&
      revenantTargetHasCondition(context, 'Bleeding')
  },
  {
    id: 'revenant.heartpiercer-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      revenantPlayer(context) && context.condition === 'Bleeding' && hasTrait(context, TRAIT.HEARTPIERCER)
  },
  {
    id: 'revenant.kallas-fervor-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      damagePerStack: 0.02,
      improvedDamagePerStack: 0.05
    },
    amount: (context, _target, parameters) => {
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? parameters.improvedDamagePerStack
        : parameters.damagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => revenantPlayer(context) && kallasFervorStacks(context) > 0
  },
  {
    id: 'revenant.kallas-fervor-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      damagePerStack: 0.02,
      improvedDamagePerStack: 0.03
    },
    amount: (context, _target, parameters) => {
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? parameters.improvedDamagePerStack
        : parameters.damagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => revenantPlayer(context) && kallasFervorStacks(context) > 0
  },
  {
    id: 'revenant.blood-fury-bleeding-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.25,
    when: (context) =>
      context.condition === 'Bleeding' && hasTrait(context, TRAIT.BLOOD_FURY) && revenantTimedBuff(context, 'fury')
  }
]);

function modifyRenegadeCriticalChance(context: Gw2ModifierContext, chance: number): number {
  if (!hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) return chance;
  const state = revenantRuntimeCoreState(context);
  const maximum = Number(state.maximumEndurance || 0);
  // 1e-9 tolerance handles floating-point endurance values that should be exactly at cap
  const full = maximum > 0 && Number(state.endurance || 0) >= maximum - 1e-9;
  // At full endurance: +33% crit; below full: +10% crit
  return chance + (full ? 0.33 : 0.1);
}

export const renegadeAttributeRules = Object.freeze({
  modifierRules: renegadeModifierRules,
  modifyCriticalChance: modifyRenegadeCriticalChance
});

export const renegadeCastRules = Object.freeze({
  modifyCastDuration: modifyRenegadeCastDuration,
  modifyRechargeDuration: modifyRenegadeRechargeDuration
});

function afterRenegadeCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.id !== ID.SOULCLEAVES_SUMMIT) return;
  const active = professionCoreState(context).activeUpkeeps.find((upkeep) => upkeep.skillId === skill.id);
  if (!active) return;
  const allies = gw2AlliedPlayerAssumptions(context.config);
  // nextAlliedProcAt is null when there are no allies, suppressing all allied-proc advance logic.
  // Math.max(1, 1/strikesPerSecond) ensures the first allied proc is at least 1s after upkeep starts
  // so the initial cast's own resolver hit doesn't immediately claim the first allied Soulcleave proc.
  active.nextAlliedProcAt =
    allies.count && allies.strikesPerSecond ? context.effectiveEnd + Math.max(1, 1 / allies.strikesPerSecond) : null;
}

function advanceRenegadeUpkeep(context: RevenantSchedulerContext, target: number): void {
  const active = professionCoreState(context).activeUpkeeps.find((upkeep) => upkeep.skillId === ID.SOULCLEAVES_SUMMIT);
  if (!active || active.nextAlliedProcAt == null || target + context.epsilon < active.nextAlliedProcAt) {
    return;
  }
  const skill = context.catalog.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = context.catalog.skillsById.get(RENEGADE_PROFILE_IDS.soulcleavesSummitProc);
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!skill || !proc || !allies.count || !allies.strikesPerSecond) return;
  // Loop catches up all missed intervals when the scheduler jumps ahead (e.g., after a long cast)
  while (active.nextAlliedProcAt != null && target + context.epsilon >= active.nextAlliedProcAt) {
    const at = active.nextAlliedProcAt;
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      for (const effect of proc.effects || []) {
        const applications = materializeSkillEffectApplications({
          skill: proc,
          effect,
          start: at,
          fullEnd: at,
          baseEvent: {
            source: 'revenant',
            sourceId: skill.id,
            actorType: effect.actorType || 'effect',
            skillId: skill.id,
            skillName: skill.name
          },
          skillWeaponFallback: 'Unequipped'
        });
        for (const application of applications) {
          context.emit({
            ...application.event,
            name: String(application.event.name || proc.name).replace(
              "Soulcleave's Summit — ",
              `Soulcleave's Summit — Ally ${allyIndex} `
            )
          });
        }
      }
    }
    // Advance by whichever is larger: the 1s internal cooldown or the ally's natural strike interval, preventing proc rates from exceeding what allies can realistically trigger
    active.nextAlliedProcAt += Math.max(Math.max(0, Number(proc.cooldown || 0)), 1 / allies.strikesPerSecond);
  }
}

function observeRenegadeEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (
    // sigil_swap events fire on every legend swap; we only care about swaps into Renegade
    event.type !== 'sigil_swap' ||
    professionCoreState(context).activeLegendId !== LEGEND.RENEGADE ||
    // Spirit Boon and Song of the Mists only trigger during active combat, not pre-cast
    !revenantCombatActive(context, event.at)
  ) {
    return;
  }
  if (hasRevenantTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitLegendInvocationProfile(context, RENEGADE_SPIRIT_BOON_PROFILE_ID, event.at, TRAIT.SPIRIT_BOON);
  }
  if (!hasRevenantTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  const song = context.catalog.skillsById.get(ID.CALL_OF_THE_RENEGADE);
  if (!song) return;
  emitLegendInvocationSkill(context, ID.CALL_OF_THE_RENEGADE, event.at, TRAIT.SONG_OF_THE_MISTS);
  // Song of the Mists grants 2 Kalla's Fervor stacks on each legend swap
  for (let index = 0; index < 2; index += 1) {
    grantKallasFervor(context, event, {
      at: event.at,
      sourceId: TRAIT.SONG_OF_THE_MISTS,
      sourceName: song.name
    });
  }
}

export const renegadeSchedulerHooks = Object.freeze({
  initialize: {
    id: 'revenant.renegade-traits',
    order: 20,
    handler: initializeRenegadeTraits
  },
  advance: {
    id: 'revenant.renegade-upkeep',
    order: 20,
    handler: advanceRenegadeUpkeep
  },
  afterCast: {
    id: 'revenant.renegade-upkeep-start',
    order: 20,
    handler: afterRenegadeCast
  },
  onEventScheduled: {
    id: 'revenant.renegade-legend-invocation',
    order: 20,
    handler: (context: RevenantSchedulerContext, event: RevenantSimulationEvent): void => {
      // Trait reactions (Ambush Commander, Endless Enmity, Blood Fury, etc.) run before legend-invocation effects so that fervor state is current when Song of the Mists fires
      observeRenegadeTraits(context, event);
      observeRenegadeEvent(context, event);
    }
  },
  taskHandlers: Object.freeze({
    [RENEGADE_CRITICAL_TRAITS_TASK]: handleRenegadeCriticalTraitsTask
  })
});
