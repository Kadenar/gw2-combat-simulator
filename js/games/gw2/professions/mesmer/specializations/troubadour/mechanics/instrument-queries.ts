import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';

/** Share the scheduler's exact instrument replacement and expiry policy with modifier queries. */
const EMPTY_EVENTS: readonly SimulationEvent[] = Object.freeze([]);

function instrumentEvents(context: Gw2ModifierContext): readonly SimulationEvent[] {
  return context.events?.filter((event) => event.type === 'mesmer.instrument') ?? EMPTY_EVENTS;
}

function instrumentChecksEnabled(context: Gw2ModifierContext): boolean {
  const specialization = context.config?.specialization;
  return !specialization || specialization === 'Troubadour';
}

export function activeInstrumentCount(context: Gw2ModifierContext): number {
  if (!instrumentChecksEnabled(context)) return 0;

  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).size;
}

/** Troubadour's registered damage modifiers query the Lute's live window and commitment order. */
export function hasLute(context: Gw2ModifierContext): boolean {
  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).has('Lute');
}

/** The active Lute grants damage only to the Troubadour, excluding illusions. */
export const luteModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.lute',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // Lute Playing buffs only the Troubadour, so illusion attacks must not inherit its damage bonus.
    when: (context) => hasLute(context) && !illusionSource(context)
  }
]);
