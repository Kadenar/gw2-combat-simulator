import { gw2Time } from '#gw2/platform/combat/clock.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { controlOnSkillBar } from '#gw2/platform/skills/input-controls.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { revenantBuffPolicies, revenantEffectStates } from '#gw2/professions/revenant/core/effect-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantAvailability } from '#gw2/professions/revenant/core/mechanics/availability.js';
import { consumeBattleScar, emitBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { swapLegend } from '#gw2/professions/revenant/core/mechanics/legends.js';
import {
  payPendingEnergy,
  revenantEndurance,
  revenantEnergy
} from '#gw2/professions/revenant/core/mechanics/resources.js';
import {
  battleScarConsumed,
  revenantConditionApplied,
  revenantLifecycleAnchored,
  revenantStruck,
  revenantWeaponSwapped
} from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { revenantUpkeepLifecycle } from '#gw2/professions/revenant/core/mechanics/upkeep-lifecycle.js';
import {
  enchantedDaggers,
  enchantedDaggersLifecycle,
  reactRevenantImpossibleOdds
} from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import { centaurLifecycle } from '#gw2/professions/revenant/core/skills/legends/centaur.js';
import {
  empowerRevenantEmbrace,
  resolveEmbracePulse,
  startRevenantEmbrace
} from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { greatswordLifecycle } from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';
import { scepterLifecycle } from '#gw2/professions/revenant/core/skills/weapons/scepter.js';
import { spearLifecycle } from '#gw2/professions/revenant/core/skills/weapons/spear.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import { modifyRevenantLifeSiphon } from '#gw2/professions/revenant/life-siphon.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

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
  prepareDamageState(runtime, skill) {
    const state = runtime.profession.core;

    if (skill?.legendId) {
      state.activeLegendId = skill.legendId;
    }
  },

  buffPolicies: revenantBuffPolicies,
  tasks: {
    'revenant.pay-energy'(runtime, data) {
      const { cast } = data as { cast: RuntimeCast<RevenantSkill> };
      payPendingEnergy(runtime, cast.id, cast.skill.name);
    },
    'revenant.embrace-pulse': (runtime, data) => resolveEmbracePulse(runtime, Number(data))
  },
  observeEffects: revenantEffectStates,
  sideEffectHandlers: {
    'revenant.embrace-opening'(runtime, context) {
      if (context.kind === 'cast') startRevenantEmbrace(runtime, context.cast);
    },
    'revenant.swap-legends'(runtime, context) {
      if (context.kind === 'cast') swapLegend(runtime, context.cast);
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

    if (runtime.engagement.explicit) runtime.fireTrigger(revenantLifecycleAnchored, { at: runtime.time });
  },
  availability: revenantAvailability,
  // Legend swaps stay free during setup until combat is established, like the runtime's weapon swaps.
  rechargeWork: (runtime, skill, work) => (skill.id === ID.SWAP_LEGENDS && !runtime.engagement.active ? 0 : work),
  onCastStart(runtime, cast) {
    const skill = cast.skill;

    // Shared execution already pays Dodge's endurance cost before specialization reactions.
    if (skill.id === SHARED_SKILL_IDS.DODGE) return;

    if (skill.id === ID.SWAP_LEGENDS) return;

    const cost = revenantEnergyCost(runtime, skill);

    if (cost === 0) return;

    if (isRevenantUpkeep(skill) || skill.energyPaidAt === 'castCommit') {
      runtime.profession.core.pendingEnergyCosts[cast.id] = cost;
      return;
    }

    if (typeof skill.energyPaidAt === 'number') {
      const spendAt = gw2Time(cast.start + skill.energyPaidAt / 1000);

      // Shortened casts such as instant Band Together summons pay on activation.
      if (cast.fullEnd >= spendAt && spendAt > cast.start) {
        // Reaching the payment time spends energy before a tied interrupt or legend swap.
        if (cast.effectiveEnd >= spendAt) {
          runtime.profession.core.pendingEnergyCosts[cast.id] = cost;
          runtime.scheduleForCast('revenant.pay-energy', spendAt, cast, {}, undefined, -101);
        }

        return;
      }
    }

    runtime.resourceController.spend('energy', cost);
  },
  onCastCancel(runtime, cast) {
    delete runtime.profession.core.pendingEnergyCosts[cast.id];
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    if (skill.energyPaidAt === 'castCommit') payPendingEnergy(runtime, cast.id, skill.name);

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
      runtime.fireTrigger(revenantWeaponSwapped, { cast });
    }

    completeRevenantCast(runtime, cast);
    // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
    empowerRevenantEmbrace(runtime, cast);
  },
  onCooldownReset(runtime) {
    // Restores in-combat Energy after the shared runtime resets cooldowns.
    if (!runtime.engagement.combatMechanicsAllowed()) return;

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
  }
};

/** Resolve Crushing Abyss before swap traits and clear upkeep reservations before retiring a cancelled follow-up. */
export const revenantCoreHooks = composeRuntimeHooks<RevenantRuntimeState, RevenantSkill>([
  scepterLifecycle,
  spearLifecycle,
  coreLifecycle,
  centaurLifecycle,
  revenantUpkeepLifecycle,
  greatswordLifecycle,
  enchantedDaggersLifecycle
]);

/** Landed player strikes interleave trait rewards, Battle Scars, and Enchanted Daggers in their established order. */
function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || !((event.coefficient || 0) > 0)) return;

  runtime.fireTrigger(revenantStruck, { cause: event });
  consumeBattleScar(runtime, event);
  runtime.fireTrigger(battleScarConsumed, { cause: event });
  enchantedDaggers(runtime, event);
}
