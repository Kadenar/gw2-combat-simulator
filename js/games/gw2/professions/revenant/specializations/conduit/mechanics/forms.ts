/** Own Conduit form transitions and expiry so trait rewards cannot separate deadline changes from scheduling. */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_CONDUIT_FORM_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { validateConduitMesmerEnergyCosts } from '#gw2/professions/revenant/specializations/conduit/mechanics/energy-cost.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const FORM_EXPIRY = 'revenant.conduit-form-expiry';

/** Changed form deadlines schedule their own wakes; older wakes cannot expire a later extension. */
function scheduleFormExpiry(runtime: RevenantRuntime): void {
  const until = conduitState.from(runtime.profession).cosmicWisdomUntil;

  if (until > runtime.time) runtime.schedule(FORM_EXPIRY, until, { until }, undefined, -200);
}

/** Apply a selected trait's extension and arm its expiry together, without reviving an expired form. */
export function extendConduitForm(runtime: RevenantRuntime, duration: number): void {
  const state = conduitState.from(runtime.profession);

  if (state.cosmicWisdomUntil <= runtime.time) return;

  state.cosmicWisdomUntil += duration;
  scheduleFormExpiry(runtime);
}

/** Clear expired or removed windows; otherwise select the current legend's form and validate its costs. */
function updateConduitForm(runtime: RevenantRuntime): void {
  const state = conduitState.from(runtime.profession);

  if (state.cosmicWisdomUntil <= runtime.time) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = '';
    return;
  }

  state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[runtime.profession.core.activeLegendId] || '';

  if (revenantConduitFormIsActive(state, 'Mesmer', runtime.time)) validateConduitMesmerEnergyCosts(runtime.helpers);
}

/** Form expiry clears the form and restores native Energy costs, unless an extension moved the deadline. */
function formExpiry(runtime: RevenantRuntime, data: unknown): void {
  const state = conduitState.from(runtime.profession);

  if (state.cosmicWisdomUntil !== (data as { until: number }).until) return;

  state.cosmicWisdomUntil = 0;
  state.conduitForm = '';
}

/** Cosmic Wisdom resolves Mistfire, then opens the current legend's form and grants Numinous Gift. */
function cosmicWisdom(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduitState.from(runtime.profession);
  runtime.fireTrigger(cosmicWisdomEntering, { cast });

  const window = requireEffect(cast.skill, 'buff', 'cosmic-wisdom');
  // Only a positive window activates a form; the independent Numinous Gift still resolves.
  state.cosmicWisdomUntil = canonicalTime(
    runtime.time + (window ? Math.max(0, effectNumber(cast.skill, window, 'duration')) : 0)
  );
  updateConduitForm(runtime);
  scheduleFormExpiry(runtime);
  runtime.fireTrigger(cosmicWisdomEntered, { cast });
}

/** Legend swaps reset affinity, extend and re-select the form, and share Found Purpose. */
function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduitState.from(runtime.profession);
  const combat = runtime.engagement.combatMechanicsAllowed();
  // The form state before the reset decides Enhanced Embodiment and the form update.
  const formActive = state.cosmicWisdomUntil > runtime.time;
  runtime.resourceController.replace('affinity', 0);
  runtime.fireTrigger(conduitLegendReset, { combat, formActive });

  if (formActive) updateConduitForm(runtime);

  // Found Purpose shares invocation boons only once combat has started.
  runtime.fireTrigger(conduitLegendSettled, { cast, combat });
}

/** Register the complete form lifecycle after immediate cast rewards and before upkeep contributions. */
export const conduitFormLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  prepareDamageState(runtime, _skill, inputs) {
    const state = conduitState.from(runtime.profession);
    state.cosmicWisdomUntil = inputs.cosmicWisdom ? Infinity : 0;
    state.conduitForm = inputs.cosmicWisdom
      ? REVENANT_CONDUIT_FORM_BY_LEGEND[runtime.profession.core.activeLegendId] || ''
      : '';
  },
  onCastCommit(runtime, cast) {
    if (cast.skill.id === ID.SWAP_LEGENDS) swapLegend(runtime, cast);
  },
  sideEffectHandlers: {
    'revenant.cosmic-wisdom'(runtime, context) {
      if (context.kind !== 'cast') return;

      // Core cast traits observe the old form before Cosmic Wisdom opens its replacement.
      completeRevenantCast(runtime, context.cast);
      cosmicWisdom(runtime, context.cast);
    }
  },
  tasks: { [FORM_EXPIRY]: formExpiry }
};

/** Mistfire captures the old form attributes before Cosmic Wisdom opens the new form. */
export const cosmicWisdomEntering = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.cosmic-wisdom-entering',
  [TRAIT.MISTFIRE]
);

/** Numinous Gift follows the completed form transition and expiry scheduling. */
export const cosmicWisdomEntered = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.cosmic-wisdom-entered',
  [TRAIT.NUMINOUS_GIFT]
);

/** Captured form activity survives affinity reset; affinity rewards precede the extension. */
export const conduitLegendReset = defineTriggerPoint<{
  readonly combat: boolean;
  readonly formActive: boolean;
}>('revenant.conduit-legend-reset', [TRAIT.LINGERING_DETERMINATION, TRAIT.ENHANCED_EMBODIMENT]);

/** Found Purpose shares invocation boons after the form follows the destination legend. */
export const conduitLegendSettled = defineTriggerPoint<{
  readonly cast: RuntimeCast<RevenantSkill>;
  readonly combat: boolean;
}>('revenant.conduit-legend-settled', [TRAIT.FOUND_PURPOSE]);
