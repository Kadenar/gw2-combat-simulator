import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_CONDUIT_FORM_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { validateConduitMesmerEnergyCosts } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { scheduleFormExpiry } from '#gw2/professions/revenant/specializations/conduit/mechanics/form-expiry.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  emitCosmicMistfire,
  extendEnhancedEmbodiment,
  grantFoundPurpose,
  grantLingeringDetermination
} from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import { numinousGift } from '#gw2/professions/revenant/specializations/conduit/traits/numinous-gift.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Clear expired or removed windows; otherwise select the current legend's form and validate its costs. */
function updateConduitForm(runtime: RevenantRuntime): void {
  const state = conduitState.from(runtime);
  if (state.cosmicWisdomUntil <= runtime.time) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = '';
    return;
  }

  state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[runtime.profession.core.activeLegendId] || '';
  if (revenantConduitFormIsActive(state, 'Mesmer', runtime.time)) validateConduitMesmerEnergyCosts(runtime.helpers);
}

/** Form expiry clears the form and restores native Energy costs, unless an extension moved the deadline. */
export function formExpiry(runtime: RevenantRuntime, data: unknown): void {
  const state = conduitState.from(runtime);
  if (state.cosmicWisdomUntil !== (data as { until: number }).until) return;
  state.cosmicWisdomUntil = 0;
  state.conduitForm = '';
}

/** Cosmic Wisdom resolves Mistfire, then opens the current legend's form and grants Numinous Gift. */
export function cosmicWisdom(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduitState.from(runtime);
  emitCosmicMistfire(runtime, cast);

  const window = requireEffect(cast.skill, 'buff', 'cosmic-wisdom');
  // Only a positive window activates a form; the independent Numinous Gift still resolves.
  state.cosmicWisdomUntil = canonicalTime(
    runtime.time + (window ? Math.max(0, effectNumber(cast.skill, window, 'duration')) : 0)
  );
  updateConduitForm(runtime);
  scheduleFormExpiry(runtime);
  numinousGift(runtime, cast);
}

/** Legend swaps reset affinity, extend and re-select the form, and share Found Purpose. */
export function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduitState.from(runtime);
  const combat = runtime.combatStartedAt();
  // The form state before the reset decides Enhanced Embodiment and the form update.
  const formActive = state.cosmicWisdomUntil > runtime.time;
  runtime.resourceController.replace('affinity', 0);
  grantLingeringDetermination(runtime, combat);
  extendEnhancedEmbodiment(runtime, formActive);

  if (formActive) updateConduitForm(runtime);

  // Found Purpose shares invocation boons only once combat has started.
  grantFoundPurpose(runtime, cast, combat);
}
