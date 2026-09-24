import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CriticalSigilDecision, CriticalSigilIntent } from '#gw2/platform/equipment/sigils/critical-procs.js';

export type SigilSuppressionReason = 'target-death' | 'observation-end' | 'precombat' | 'miss';

interface SigilObservation extends CriticalSigilDecision {
  readonly chance: number;
}

export interface CriticalSigilDiagnostic {
  readonly causeEventOrder: number | null;
  readonly at: number;
  readonly sigil: string;
  readonly status: 'confirmed' | 'predicted-only' | 'actual-only' | 'changed' | 'resolver-only';
  readonly predicted?: SigilObservation;
  readonly actual?: SigilObservation;
  readonly suppression?: SigilSuppressionReason;
}

/** Correlate only within one pass; recording has no access to random streams or mutable combat state. */
export function createCriticalSigilDiagnostics() {
  const predicted = new Map<number, { event: SimulationEvent; observation: SigilObservation }>();
  const actual = new Map<number, { event: SimulationEvent; observation: SigilObservation }>();
  const resolverOnly: CriticalSigilDiagnostic[] = [];
  const suppressedCauses = new Map<number, SigilSuppressionReason>();
  const suppressedEffects = new Map<string, SigilSuppressionReason>();
  const record = (
    phase: 'prediction' | 'resolution',
    event: SimulationEvent,
    chance: number,
    decision: CriticalSigilDecision
  ): void => {
    const observation = { ...decision, chance };
    if (!Number.isFinite(event.eventOrder)) {
      if (phase === 'resolution')
        for (const proc of decision.procs)
          resolverOnly.push({
            causeEventOrder: null,
            at: event.at,
            sigil: proc.name,
            status: 'resolver-only',
            actual: observation
          });
      return;
    }

    (phase === 'prediction' ? predicted : actual).set(event.eventOrder!, { event, observation });
  };

  return {
    record,
    suppress(event: SimulationEvent, reason: SigilSuppressionReason): void {
      // Effect suppression is distinct from rejecting its hit: the hit may have committed a cooldown already.
      if (Number.isFinite(event.sigilCauseEventOrder)) {
        suppressedEffects.set(`${event.sigilCauseEventOrder}:${event.sourceId}`, reason);
      } else if (event.type === 'damage' && Number.isFinite(event.eventOrder)) {
        suppressedCauses.set(event.eventOrder!, reason);
      }
    },
    results(): CriticalSigilDiagnostic[] {
      const rows: CriticalSigilDiagnostic[] = [];
      for (const id of new Set([...predicted.keys(), ...actual.keys()])) {
        const prediction = predicted.get(id);
        const resolution = actual.get(id);
        const before = prediction?.observation;
        const after = resolution?.observation;
        const names = new Set([...(before?.procs || []), ...(after?.procs || [])].map((proc) => proc.name));
        for (const name of names) {
          const expected = before?.procs.find((proc) => proc.name === name);
          const suppression = suppressedCauses.get(id) ?? suppressedEffects.get(`${id}:sigil.${name.toLowerCase()}`);
          const resolved: CriticalSigilIntent | undefined = suppression
            ? undefined
            : after?.procs.find((proc) => proc.name === name);
          const status = !expected
            ? 'actual-only'
            : !resolved
              ? 'predicted-only'
              : expected.readyAt === resolved.readyAt && before?.chance === after?.chance
                ? 'confirmed'
                : 'changed';
          rows.push({
            causeEventOrder: id,
            at: (prediction || resolution)!.event.at,
            sigil: name,
            status,
            ...(before ? { predicted: before } : {}),
            ...(after ? { actual: after } : {}),
            ...(suppression ? { suppression } : {})
          });
        }
      }

      return [...rows, ...resolverOnly].sort((a, b) => a.at - b.at);
    }
  };
}

export type CriticalSigilDiagnostics = ReturnType<typeof createCriticalSigilDiagnostics>;
