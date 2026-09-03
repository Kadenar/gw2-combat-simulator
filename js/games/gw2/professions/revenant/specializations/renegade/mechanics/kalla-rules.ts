import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState,
  revenantTimedBuff
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/mechanics/legend-swap.js';
import { emitLegendInvocationProfile, emitLegendInvocationSkill } from '#gw2/professions/revenant/core/traits/index.js';
import { grantKallasFervor } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import {
  RENEGADE_PROFILE_IDS,
  RENEGADE_SPIRIT_BOON_PROFILE_ID
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import {
  handleRenegadeCriticalTraitsTask,
  handleRazorclawProcTask,
  initializeRenegadeTraits,
  modifyRenegadeCastDuration,
  modifyRenegadeRechargeDuration,
  observeRenegadeTraits,
  RENEGADE_CRITICAL_TRAITS_TASK,
  RENEGADE_RAZORCLAW_PROC_TASK
} from '#gw2/professions/revenant/specializations/renegade/traits/index.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

function kallasFervorStacks(context: Gw2ModifierContext): number {
  // Count only applications that have started (at ≤ time) and not yet expired (expiresAt > time)
  const state = revenantRuntimeSpecializationState(context, 'Renegade');
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
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.HEARTPIERCER) &&
      targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'revenant.heartpiercer-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.HEARTPIERCER)
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
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
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
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
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
  // The specialization-local timer is null when there are no allies, suppressing allied-proc advance logic.
  // Math.max(1, 1/strikesPerSecond) ensures the first allied proc is at least 1s after upkeep starts
  // so the initial cast's own resolver hit doesn't immediately claim the first allied Soulcleave proc.
  renegadeState.from(context).soulcleaveNextAlliedProcAt =
    allies.count && allies.strikesPerSecond ? context.effectiveEnd + Math.max(1, 1 / allies.strikesPerSecond) : null;
}

function advanceRenegadeUpkeep(context: RevenantSchedulerContext, target: number): void {
  const active = professionCoreState(context).activeUpkeeps.find((upkeep) => upkeep.skillId === ID.SOULCLEAVES_SUMMIT);
  const state = renegadeState.from(context);
  if (!active) {
    state.soulcleaveNextAlliedProcAt = null;
    return;
  }

  if (state.soulcleaveNextAlliedProcAt == null || target + context.epsilon < state.soulcleaveNextAlliedProcAt) {
    return;
  }

  const skill = context.catalog.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = context.catalog.skillsById.get(RENEGADE_PROFILE_IDS.soulcleavesSummitProc);
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!skill || !proc || !allies.count || !allies.strikesPerSecond) return;
  // Loop catches up all missed intervals when the scheduler jumps ahead (e.g., after a long cast)
  while (state.soulcleaveNextAlliedProcAt != null && target + context.epsilon >= state.soulcleaveNextAlliedProcAt) {
    const at = state.soulcleaveNextAlliedProcAt;
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
    state.soulcleaveNextAlliedProcAt += Math.max(Math.max(0, Number(proc.cooldown || 0)), 1 / allies.strikesPerSecond);
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

  if (hasTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitLegendInvocationProfile(context, RENEGADE_SPIRIT_BOON_PROFILE_ID, event.at, TRAIT.SPIRIT_BOON);
  }

  if (!hasTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
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
    [RENEGADE_CRITICAL_TRAITS_TASK]: handleRenegadeCriticalTraitsTask,
    [RENEGADE_RAZORCLAW_PROC_TASK]: handleRazorclawProcTask
  })
});
