/** Keep instrument replacement, historical ordering, and detached projections consistent across their readers. */
import type { ExecutedFactsReader } from '#gw2/platform/combat/history/executed-facts.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { ProfessionAttributePreviewPreparation } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { canonicalTime } from '#kernel/core/clock.js';

const INSTRUMENTS = ['Lute', 'Flute', 'Harp', 'Drum'] as const;

/** Select replacement before expiry so an older, longer window cannot revive after a shorter performance. */
function instrumentsAt(
  events: readonly SimulationEvent[],
  at: number,
  currentEvent?: SimulationEvent | null
): ReadonlyMap<string, number> {
  at = canonicalTime(at);
  const latest = new Map<string, SimulationEvent>();
  for (const event of events) {
    if (event.type !== 'mesmer.instrument' || event.at > at) continue;

    // A commitment cannot affect a same-time action that preceded it.
    if (event.at === at && Number(event.eventOrder) > Number(currentEvent?.eventOrder)) continue;

    const name = String(event.instrument);
    const previous = latest.get(name);

    if (
      !previous ||
      event.at > previous.at ||
      (event.at === previous.at && (event.eventOrder || 0) >= (previous.eventOrder || 0))
    )
      latest.set(name, event);
  }

  return new Map(
    [...latest]
      .filter(([, event]) => Number(event.expiresAt) > at)
      .map(([name, event]) => [name, Number(event.expiresAt)])
  );
}

/** Accepted casts use their action's order cutoff; impact and recovery queries use every committed window. */
export function playingTroubadourInstruments(
  facts: ExecutedFactsReader,
  at: number,
  activationId?: string
): ReadonlyMap<string, number> {
  return instrumentsAt(facts.read(), at, activationId === undefined ? undefined : facts.actionFor(activationId));
}

/** Modifier queries share the historical rules without requiring runtime controllers or mutable state. */
export function activeInstrumentCount(context: Gw2ModifierContext): number {
  const specialization = context.config?.specialization;

  if (specialization && specialization !== 'Troubadour') return 0;

  return instrumentsAt(context.events ?? [], context.time, context.event).size;
}

export function hasLute(context: Gw2ModifierContext): boolean {
  return instrumentsAt(context.events ?? [], context.time, context.event).has('Lute');
}

/** Recovery integration must split at every committed Flute start and expiry, including replaced windows. */
export function troubadourFluteTransitions(facts: ExecutedFactsReader): number[] {
  return facts
    .read()
    .flatMap((event) =>
      event.type === 'mesmer.instrument' && event.instrument === 'Flute' ? [event.at, Number(event.expiresAt)] : []
    );
}

/** Update the live window before publishing the commitment, without changing the last performed instrument. */
export function replaceTroubadourInstrumentWindow(
  windows: Record<string, number>,
  instrument: string,
  at: number,
  expiresAt: number
) {
  windows[instrument] = expiresAt;
  return { type: 'mesmer.instrument', at, instrument, expiresAt };
}

/** Planning readers have live deadlines rather than history; projection never prunes or spends those windows. */
export function projectTroubadourInstruments(windows: Readonly<Record<string, number>>, at: number) {
  at = canonicalTime(at);
  return Object.entries(windows)
    .filter(([, expiresAt]) => expiresAt > at)
    .map(([name, expiresAt]) => ({
      name,
      remaining: Math.max(0, Math.round((expiresAt - at) * 1000))
    }));
}

/** Both detached previews select the same instruments without spending notes or performing their attacks. */
export function assumedTroubadourInstruments(count: number, at: number, expiresAt: number, sourceId: string) {
  return INSTRUMENTS.slice(0, count).map((instrument) => ({
    type: 'mesmer.instrument' as const,
    at,
    expiresAt,
    instrument,
    source: 'Fortissimo',
    sourceId,
    actorType: ACTOR.PLAYER
  }));
}

/** Attribute assumptions belong only to the detached query's event history. */
export function prepareTroubadourInstrumentPreview(context: ProfessionAttributePreviewPreparation): void {
  context.events.push(...assumedTroubadourInstruments(Number(context.values.instruments || 0), 0, 60, 'stat-preview'));
}
