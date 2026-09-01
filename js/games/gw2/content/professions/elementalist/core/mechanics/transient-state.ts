/** Advances and expires transient Core Elementalist state on the scheduler clock. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chains.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/content/professions/elementalist/core/state.js';
import {
  extendPersistingFlamesField,
  observeElementalistTraitEvent,
  processFreshAirCandidates
} from '#gw2/content/professions/elementalist/core/traits/index.js';
import { observeElementalistElementalEvent } from '#gw2/content/professions/elementalist/core/skills/elementals.js';
import { emitProfiledCondition } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { updateEndurance } from '#gw2/content/professions/elementalist/core/mechanics/endurance.js';

// Observe scheduled combat packets to update aura, attunement, and trait state
// that depends on the canonical event timeline.
export function observeElementalistEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  observeElementalistElementalEvent(context, event);
  extendPersistingFlamesField(context, event);
  const state = professionCoreState(context);
  // Shattering Stone arms a limited number of bleeding follow-ups that the next
  // qualifying player damage packets consume.
  if (
    event.type === 'damage' &&
    event.actorType !== 'summon' &&
    Number(event.coefficient || 0) > 0 &&
    state.shatteringStoneHitsRemaining > 0 &&
    event.at <= state.shatteringStoneUntil + context.epsilon
  ) {
    state.shatteringStoneHitsRemaining -= 1;
    if (state.shatteringStoneHitsRemaining === 0) {
      state.shatteringStoneUntil = 0;
    }

    emitProfiledCondition(
      context,
      event.at + context.epsilon,
      PROFILE.shatteringStone,
      'Triggered Bleeding',
      'Bleeding',
      1,
      5,
      'Shattering Stone',
      event.skillId ?? event.sourceId
    );
  }

  observeElementalistTraitEvent(context, event);
}

// Advance probabilistic trait progress and endurance, then expire transient
// auras, orbs, chains, and conjures at the requested scheduler timestamp.
export function advanceElementalistState(context: ElementalistSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  processFreshAirCandidates(context, at);
  updateEndurance(context, state, at, Boolean(context.config.boons?.vigor));
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  // Expire hammer orbs together with the metadata Grand Finale reads from them.
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (Number(state.hammerOrbs[element] || 0) < at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbGrantedBy[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }

  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups)) {
    if (expiresAt < at) delete state.conjurePickups[weapon];
  }

  if (state.shatteringStoneUntil < at) {
    state.shatteringStoneUntil = 0;
    state.shatteringStoneHitsRemaining = 0;
  }

  if (state.dazingDischargeUntil < at) state.dazingDischargeUntil = 0;
  // A barrier that lapses unthrown starts the skill's recharge from its expiry and
  // rearms the chain so Rock Barrier, not Hurl, is offered again.
  if (state.rockBarrierExpiresAt > 0 && state.rockBarrierExpiresAt <= at) {
    const expiresAt = state.rockBarrierExpiresAt;
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsById.get(ID.ROCK_BARRIER);
    if (root) {
      context.state.cooldowns.set(
        root.id,
        expiresAt +
          context.rechargeDurationFor(root, expiresAt, {
            rockBarrierRelease: true
          })
      );
      resetAutoattackChains(context, [root.id]);
    }
  }
}
