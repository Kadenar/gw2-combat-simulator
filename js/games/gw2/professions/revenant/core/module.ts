import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvingDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import { revenantCoreEventHandlers } from '#gw2/professions/revenant/core/mechanics/state-events.js';
import {
  revenantCoreAttributeRules,
  modifyRevenantLifeSiphon,
  revenantCastRules
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import {
  emitRevenantStateSnapshot,
  projectRevenantEndState,
  snapshotRevenantState
} from '#gw2/professions/revenant/state.js';
import { revenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import {
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_CORE_BALANCE_PROFILES } from '#gw2/professions/revenant/core/profiles.js';
import { revenantCoreSkillHandlers } from '#gw2/professions/revenant/core/execution/index.js';
import type {
  RevenantSchedulerContext,
  RevenantCastContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import { handleCrushingAbyssWeaponSwap } from '#gw2/professions/revenant/core/execution/spear.js';
import {
  advanceRevenantSpearState,
  handleAbyssalRazeRechargeReduction,
  handleCrushingAbyssGain,
  observeRevenantSpearEvent
} from '#gw2/professions/revenant/core/mechanics/crushing-abyss.js';
import { afterRevenantCast, observeRevenantEvent } from '#gw2/professions/revenant/core/mechanics/scheduler-hooks.js';
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  observeRevenantWeaponEvent,
  resetCoalescenceOfRuin
} from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { completeRevenantFollowup } from '#gw2/professions/revenant/core/mechanics/skill-flips.js';
import {
  handleRevenantUpkeepPulse,
  handleImpossibleOddsStrike
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { prepareRevenantHitboxEvent } from '#gw2/professions/revenant/core/mechanics/hitbox.js';
import { spendRevenantEnergy } from '#gw2/professions/revenant/energy.js';
import { advanceRevenantEnergy } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { handleBlossomingAura } from '#gw2/professions/revenant/core/execution/scepter.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/traits/index.js';
import {
  ASSASSINS_PRESENCE_TASK,
  scheduleAssassinsPresence,
  handleAssassinsPresencePulse
} from '#gw2/professions/revenant/core/traits/devastation.js';

/**
 * Pays the skill's Energy cost and captures weapon state at cast start.
 */
function onCastStart(context: RevenantCastContext, skill: RevenantSkill): void {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

/**
 * Commits completion-gated Core weapon mechanics.
 */
function onCastComplete(context: RevenantCastContext, skill: RevenantSkill): void {
  completeRevenantFollowup(context, skill);
  completeRevenantWeaponCast(context, skill);
}

function advance(context: RevenantSchedulerContext, time: number): void {
  advanceRevenantEnergy(context, time);
  advanceRevenantSpearState(context, time);
}

function onEventScheduled(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  observeRevenantWeaponEvent(context, event);
  observeRevenantSpearEvent(context, event);
  observeRevenantEvent(context, event);
}

/** Registers Core Revenant resources, weapons, traits, and tasks in scheduler order. */
export const revenantSchedulerHooks = Object.freeze({
  initialize: scheduleAssassinsPresence,
  advance,
  prepareEvent: {
    id: 'revenant.hitbox',
    order: 10,
    handler: prepareRevenantHitboxEvent
  },
  onCastStart,
  onCastComplete,
  afterCast: afterRevenantCast,
  /** Makes legend swap available and restores in-combat Energy after a global cooldown reset. */
  onCooldownReset: (context: RevenantSchedulerContext): void => {
    const state = professionCoreState(context);
    state.legendSwapReadyAt = context.state.time;
    if (!revenantCombatActive(context)) return;
    state.energy = state.maximumEnergy;
    state.energyUpdatedAt = context.state.time;
    state.energyAccrual = undefined;
    emitRevenantStateSnapshot(context, context.state.time, 'cooldown-reset');
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    [ASSASSINS_PRESENCE_TASK]: handleAssassinsPresencePulse,
    'revenant.blossoming-aura': handleBlossomingAura,
    'revenant.abyssal-raze-recharge': handleAbyssalRazeRechargeReduction,
    'revenant.crushing-abyss-gain': handleCrushingAbyssGain,
    'revenant.crushing-abyss-weapon-swap': handleCrushingAbyssWeaponSwap,
    'revenant.upkeep-pulse': handleRevenantUpkeepPulse,
    'revenant.imperial-guard-expire': expireImperialGuard,
    'revenant.impossible-odds-strike': handleImpossibleOddsStrike,
    'revenant.drop-the-hammer-reset': resetCoalescenceOfRuin
  })
});

export const revenantCoreModule = defineNativeModule({
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    balanceProfiles: REVENANT_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createRevenantCoreState,
    resolver: createRevenantCoreState,
    project: projectRevenantEndState
  },
  mechanics: {
    modifiers: revenantCoreAttributeRules,
    execution: {
      skillHandlers: revenantCoreSkillHandlers,
      castRules: revenantCastRules,
      hooks: {
        ...revenantSchedulerHooks,
        snapshot: (context: RevenantSchedulerContext) => snapshotRevenantState(context.state.profession)
      }
    },
    resolution: {
      reactions: [onResolvingDamage({ id: 'revenant.life-siphon', handler: modifyRevenantLifeSiphon })],
      hooks: {
        eventHandlers: revenantCoreEventHandlers
      }
    }
  },
  presentation: revenantCoreUi
});
