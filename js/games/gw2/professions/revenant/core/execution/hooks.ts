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
  empowerEmbraceTheDarkness,
  handleRevenantUpkeepPulse,
  handleImpossibleOddsStrike
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { prepareRevenantHitboxEvent } from '#gw2/professions/revenant/core/mechanics/hitbox.js';
import { emitRevenantStateSnapshot, spendRevenantEnergy } from '#gw2/professions/revenant/family-state.js';
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
  // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
  if (!context.action.cancelled) empowerEmbraceTheDarkness(context, skill);
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
