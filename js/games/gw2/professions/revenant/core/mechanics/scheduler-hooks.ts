/** Coordinates Core scheduler reactions in their established trait, equipment, and skill order. */
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitLegendInvocationProfile } from '#gw2/professions/revenant/core/traits/invocation-effects.js';
import { revenantCombatActive } from '#gw2/professions/revenant/core/traits/index.js';
import { applyIncensedResponse } from '#gw2/professions/revenant/core/traits/invocation.js';
import { applyAbyssalChill } from '#gw2/professions/revenant/core/traits/corruption.js';
import {
  scheduleAssassinsPresence,
  applyBattleScarred,
  applyBrutality,
  applyDanceOfDeath,
  applyExposeDefenses,
  applyNotoriety,
  applyThrillOfCombat,
  consumeBattleScar
} from '#gw2/professions/revenant/core/traits/devastation.js';
import { applyDwarvenBattleTraining, applyViciousReprisal } from '#gw2/professions/revenant/core/traits/retribution.js';
import { scheduleImpossibleOddsStrike } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { triggerEnchantedDaggers } from '#gw2/professions/revenant/core/mechanics/enchanted-daggers.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

/** Schedules cast traits after packet handling; completion-gated effects use onCastComplete. */
export function afterRevenantCast(context: RevenantCastContext, skill: RevenantSkill): void {
  applyBattleScarred(context, skill);
  if (revenantCombatActive(context, context.effectiveEnd)) applyNotoriety(context, skill);

  // Grant only the boon belonging to the committed Centaur skill; toggling off the shield grants nothing.
  if (!hasTrait(context, TRAIT.SERENE_REJUVENATION) || context.action.cancelled) return;
  const skillId = skill.id === ID.PROTECTIVE_SOLACE_ID_29310 ? ID.PROTECTIVE_SOLACE : skill.id;
  if (
    skillId === ID.PROTECTIVE_SOLACE &&
    !professionCoreState(context).activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)
  )
    return;
  emitLegendInvocationProfile(
    context,
    TRAIT.SERENE_REJUVENATION,
    context.effectiveEnd,
    TRAIT.SERENE_REJUVENATION,
    (effect) => effect.metadata?.trigger === String(skillId)
  );
}

/** Observes each scheduler event once and preserves mixed trait, relic, and base-skill ordering. */
export function observeRevenantEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type === 'combat_start') scheduleAssassinsPresence(context, event.at);
  if (revenantCombatActive(context, event.at)) applyIncensedResponse(context, event);
  scheduleImpossibleOddsStrike(context, event);

  if (
    context.config.relic === 'Peitha' &&
    event.type === 'damage' &&
    // Use the initial strike's identity so display labels cannot change shadowstep procs.
    ((event.skillId === ID.DEATHSTRIKE && event.sourceId === ID.DEATHSTRIKE) ||
      event.skillName === "Phantom's Onslaught" ||
      // Unrelenting Assault's opening shadowstep triggers one relic attack, not one per strike.
      (event.skillId === ID.UNRELENTING_ASSAULT && event.hitIndex === 1) ||
      event.skillId === ID.PHASE_SMASH)
  ) {
    const delay = event.skillId === ID.PHASE_SMASH ? 0 : event.skillName === 'Deathstrike' ? 0.24 : 0.68;
    context.emitDerived(event, {
      type: 'peitha',
      at: event.at + delay,
      source: 'revenant',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Relic of Peitha'
    });
  }

  applyBrutality(context, event);
  applyDwarvenBattleTraining(context, event);
  if (event.type === 'condition') {
    applyAbyssalChill(context, event);
    applyDanceOfDeath(context, event);
  }

  if (event.type === 'damage' && event.actorType === 'player' && Number(event.coefficient || 0) > 0) {
    applyThrillOfCombat(context, event);
    consumeBattleScar(context, event);
    applyViciousReprisal(context, event);
    if (revenantCombatActive(context, event.at)) applyExposeDefenses(context, event);

    triggerEnchantedDaggers(context, event);
  }
}
