import { controlOnSkillBar } from '#gw2/platform/results/input-trace.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/traits/invocation/queries.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { revenantBuffPolicies, revenantEffectStates } from '#gw2/professions/revenant/core/effect-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { consumeBattleScar, emitBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import {
  revenantStruck,
  battleScarConsumed,
  revenantConditionApplied,
  revenantLifecycleAnchored,
  revenantWeaponSwapped
} from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { revenantEndurance, revenantEnergy } from '#gw2/professions/revenant/core/mechanics/resources.js';
import {
  activateRevenantUpkeep,
  reserveRevenantUpkeep,
  cancelRevenantUpkeep,
  releaseRevenantUpkeep,
  REVENANT_ENERGY_DEPLETED,
  starveRevenantUpkeeps,
  upkeepRelease
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  REVENANT_UPKEEP_PULSE,
  revenantUpkeepPulse,
  scheduleRevenantUpkeepPulses
} from '#gw2/professions/revenant/core/mechanics/upkeep-pulses.js';
import { revenantAvailability } from '#gw2/professions/revenant/core/mechanics/availability.js';
import { swapLegend } from '#gw2/professions/revenant/core/mechanics/legends.js';
import {
  enchantedDaggers,
  enchantedDaggersLifecycle,
  reactRevenantImpossibleOdds
} from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import { empowerRevenantEmbrace, startRevenantEmbrace } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { greatswordLifecycle } from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';
import { scepterLifecycle } from '#gw2/professions/revenant/core/skills/weapons/scepter.js';
import { spearLifecycle } from '#gw2/professions/revenant/core/skills/weapons/spear.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import type { RevenantRuntimeState, RevenantSkill, RevenantResolverContext } from '#gw2/professions/revenant/types.js';

const DODGE_IDS = new Set<SkillId>([SHARED_SKILL_IDS.DODGE, VINDICATOR_JUMP_SKILL.id]);

/** Core hooks: Energy, upkeeps, legends, weapon follow-ups, and actual hit/application trait reactions. */

const coreLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  /** Legend utilities resolve against the legend active at input acceptance. */
  resolveInputControl(context, skill) {
    const bar = context.config.skillInputBars?.find((bar) => bar.id === context.profession.core.activeLegendId);
    const control = bar && controlOnSkillBar(context.helpers, skill, bar);
    return control ? { control } : undefined;
  },
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'battle-scars',
      name: 'Battle Scars',
      source: 'Profession',
      unit: 'charge',
      sourceIds: ['revenant.battle-scars'],
      emit: (runtime) => emitBattleScar(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = runtime.profession.core;

    if (skill?.legendId) {
      state.activeLegendId = skill.legendId;
    }

    // Both the stat strip and occurrences consume the control's canonical serialized skill identity.
    const upkeepId = JSON.parse(String(inputs.upkeep ?? 'null'));
    const upkeep = runtime.helpers.skills.find((entry) => entry.id === upkeepId && entry.upkeepCost != null);

    if (upkeep)
      // Prepared upkeep needs the same activation identity as combat so depletion can retire its owner.
      state.activeUpkeeps = [
        { skillId: upkeep.id, upkeepCost: Number(upkeep.upkeepCost), startsAt: runtime.time, empoweredNextPulse: false }
      ];
  },

  buffPolicies: revenantBuffPolicies,
  observeEffects: revenantEffectStates,
  // Shared actions own legends and upkeep; skill lifecycles register their own actions below.
  sideEffectHandlers: {
    'revenant.embrace-opening'(runtime, context) {
      if (context.kind === 'cast') startRevenantEmbrace(runtime, context.cast);
    },
    'revenant.release-upkeep'(runtime, context) {
      if (context.kind === 'cast') releaseRevenantUpkeep(runtime, context.cast);
    },
    'revenant.swap-legends'(runtime, context) {
      if (context.kind === 'cast') swapLegend(runtime, context.cast);
    },
    // Reserve before activation, then pay before the upkeep changes live cost queries.
    'revenant.reserve-upkeep'(runtime, context) {
      if (context.kind === 'cast') reserveRevenantUpkeep(runtime, context.cast);
    },
    'revenant.activate-upkeep'(runtime, context) {
      if (context.kind !== 'cast') return;

      activateRevenantUpkeep(runtime, context.cast);
      scheduleRevenantUpkeepPulses(runtime, context.cast);
    }
  },
  resources: { energy: revenantEnergy },
  endurance: revenantEndurance,
  initialize(runtime) {
    runtime.fireTrigger(revenantLifecycleAnchored, { at: runtime.time });
  },
  onCombatStart(runtime) {
    // Accepted combat raises the recovery ceiling; an authored marker also re-anchors Assassin's Presence.
    runtime.profession.core.combatBeganAt = runtime.time;
    runtime.resourceController.refresh('energy');

    if (runtime.hasExplicitCombatStart) runtime.fireTrigger(revenantLifecycleAnchored, { at: runtime.time });
  },
  availability: revenantAvailability,
  // Legend swaps stay free during setup until combat is established, like the runtime's weapon swaps.
  rechargeWork: (runtime, skill, work) => (skill.id === ID.SWAP_LEGENDS && !runtime.combatActive ? 0 : work),
  modifyEffects(runtime, cast, effects) {
    // Upkeep owners emit their own activation and recurring payloads.
    if (isRevenantUpkeep(cast.skill)) return [];

    if (upkeepRelease(runtime, cast.skill)) return [];

    return effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;

    if (DODGE_IDS.has(skill.id)) return;

    if (!isRevenantUpkeep(skill) && skill.id !== ID.SWAP_LEGENDS)
      runtime.resourceController.spend('energy', revenantEnergyCost(runtime, skill));
  },
  onCastCancel: cancelRevenantUpkeep,
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
      runtime.fireTrigger(revenantWeaponSwapped, { cast });
    }

    completeRevenantCast(runtime, cast);
    // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
    empowerRevenantEmbrace(runtime, cast);
  },
  onCooldownReset(runtime) {
    // Restores in-combat Energy after the shared runtime resets cooldowns.
    if (!runtime.combatStartedAt()) return;

    runtime.resourceController.grant('energy', runtime.profession.core.energy.maximum);
  },
  // Resolver triggers retain trait ownership and the accepted event's causal chain.

  reactions: {
    'damage.resolving'(runtime, event) {
      return modifyRevenantLifeSiphon(runtime, event);
    },
    'damage.resolved'(runtime, event) {
      reactRevenantImpossibleOdds(runtime, event);
      reactRevenantPlayerStrike(runtime, event);
    },
    'condition.applied': (runtime, cause) => runtime.fireTrigger(revenantConditionApplied, { cause })
  },
  tasks: {
    [REVENANT_ENERGY_DEPLETED]: starveRevenantUpkeeps,
    [REVENANT_UPKEEP_PULSE]: revenantUpkeepPulse
  }
};

/** Resolve Crushing Abyss before swap traits and clear upkeep reservations before retiring a cancelled follow-up. */
export const revenantCoreHooks = composeRuntimeHooks<RevenantRuntimeState, RevenantSkill>([
  scepterLifecycle,
  spearLifecycle,
  coreLifecycle,
  greatswordLifecycle,
  enchantedDaggersLifecycle
]);

/** Applies Fury's life-steal bonus to Core and elite specializations without using ordinary strike scaling. */
function modifyRevenantLifeSiphon(context: RevenantResolverContext, event: Gw2ResolverEvent) {
  const bonus = revenantLifeSiphonBonus(context, event);

  if (bonus == null) return;

  return { flatStrikeMultiplier: (event.flatStrikeMultiplier ?? 1) * (1 + bonus) };
}

/** Landed player strikes interleave trait rewards, Battle Scars, and Enchanted Daggers in their established order. */
function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !((event.coefficient || 0) > 0)) return;

  runtime.fireTrigger(revenantStruck, { cause: event });
  consumeBattleScar(runtime, event);
  runtime.fireTrigger(battleScarConsumed, { cause: event });
  enchantedDaggers(runtime, event);
}
