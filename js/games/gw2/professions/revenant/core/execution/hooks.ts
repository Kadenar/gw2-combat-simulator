import { grantResource, refreshResource } from '#gw2/platform/combat/resources/resource-policy.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { RevenantSchedulerContext, RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { crushingAbyssSwapReaction } from '#gw2/professions/revenant/core/execution/spear.js';
import {
  advanceRevenantSpearState,
  abyssalRazeRechargeReaction,
  handleCrushingAbyssGain
} from '#gw2/professions/revenant/core/mechanics/crushing-abyss.js';
import { afterRevenantCast, observeRevenantEvent } from '#gw2/professions/revenant/core/mechanics/scheduler-hooks.js';
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  dropTheHammerReaction
} from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import {
  empowerEmbraceTheDarkness,
  upkeepPulses,
  handleImpossibleOddsStrike
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { prepareRevenantHitboxEvent } from '#gw2/professions/revenant/core/mechanics/hitbox.js';
import {
  emitRevenantStateSnapshot,
  runtimeRevenantEnergyCost,
  spendRevenantEnergy
} from '#gw2/professions/revenant/family-state.js';
import { advanceRevenantEnergy, energyDepletion } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { blossomingAura } from '#gw2/professions/revenant/core/execution/scepter.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/traits/index.js';
import { scheduleAssassinsPresence, assassinsPresence } from '#gw2/professions/revenant/core/traits/devastation.js';

const castEnergyCosts = new WeakMap<SimulationEvent, number>();

/** Defers upkeep activation costs while their separate sustained drain remains active out of combat. */
function onCastStart(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.handlerId === 'revenant.upkeep') {
    castEnergyCosts.set(context.action, runtimeRevenantEnergyCost(context, skill));
  } else {
    spendRevenantEnergy(context, skill);
  }

  beginRevenantWeaponCast(context, skill);
}

/** Commits an upkeep's deferred activation cost and Core weapon mechanics after cast completion. */
function onCastComplete(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.handlerId === 'revenant.upkeep') {
    const cost = castEnergyCosts.get(context.action) ?? 0;
    castEnergyCosts.delete(context.action);
    if (!context.action.cancelled) spendRevenantEnergy(context, skill, cost, context.effectiveEnd);
  }

  // Call to Anguish exposes a persistent follow-up until Unyielding Impact consumes it.
  const flips = professionCoreState(context).availableFlips;
  if (skill.id === ID.CALL_TO_ANGUISH) {
    armSkillFlip(flips, ID.UNYIELDING_IMPACT, context.effectiveEnd);
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'unyielding-impact-ready');
  } else if (skill.id === ID.UNYIELDING_IMPACT) {
    consumeSkillFlip(flips, ID.UNYIELDING_IMPACT);
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'unyielding-impact-used');
  }

  completeRevenantWeaponCast(context, skill);
  // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
  if (!context.action.cancelled) empowerEmbraceTheDarkness(context, skill);
}

function advance(context: RevenantSchedulerContext, time: number): void {
  advanceRevenantEnergy(context, time);
  advanceRevenantSpearState(context, time);
}

function onEventScheduled(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const core = professionCoreState(context);
  if (core.combatBeganAt == null && ['combat_start', 'damage', 'condition', 'control', 'blind'].includes(event.type)) {
    // Read the shared combat observer after this event's facts have actually committed.
    context.tasks.schedule({
      type: 'revenant.combat-energy',
      at: Math.max(context.state.time, event.at),
      priority: -59
    });
  }

  dropTheHammerReaction.onEventScheduled.handler(context, event);
  crushingAbyssSwapReaction.onEventScheduled.handler(context, event);
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
  /** Restores in-combat Energy after the shared scheduler resets cooldowns. */
  onCooldownReset: (context: RevenantSchedulerContext): void => {
    const state = professionCoreState(context);
    if (!revenantCombatActive(context)) return;
    grantResource(context, 'energy', state.energy.maximum);
    emitRevenantStateSnapshot(context, context.state.time, 'cooldown-reset');
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    ...assassinsPresence.taskHandlers,
    ...energyDepletion.taskHandlers,
    'revenant.combat-energy': (context: RevenantSchedulerContext) => {
      const core = professionCoreState(context);
      const at = context.schedulerPolicy.combatBeganAt?.();
      if (core.combatBeganAt == null && at != null) {
        core.combatBeganAt = at;
        refreshResource(context, 'energy');
      }
    },
    ...blossomingAura.taskHandlers,
    ...abyssalRazeRechargeReaction.taskHandlers,
    'revenant.crushing-abyss-gain': handleCrushingAbyssGain,
    ...crushingAbyssSwapReaction.taskHandlers,
    ...upkeepPulses.taskHandlers,
    'revenant.imperial-guard-expire': expireImperialGuard,
    'revenant.impossible-odds-strike': handleImpossibleOddsStrike,
    ...dropTheHammerReaction.taskHandlers
  })
});
