import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CriticalSigilDecision } from '#gw2/platform/equipment/sigils/critical-procs.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';

export type SigilSuppressionReason = 'target-death' | 'observation-end' | 'precombat' | 'miss';
export interface CriticalSigilDiagnostic {
  readonly causeEventOrder: number | null;
  readonly at: number;
  readonly sigil: string;
  readonly chance?: number;
  readonly didCrit?: boolean;
  readonly claimed: boolean;
  readonly readyAt?: number;
  suppression?: SigilSuppressionReason;
}

/** Record actual eligibility, shared critical draws and claims without consuming randomness or predicting effects. */
export function createCriticalSigilDiagnostics() {
  const rows: CriticalSigilDiagnostic[] = [];
  const procs = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;
  return {
    record(
      event: SimulationEvent,
      names: readonly string[],
      critical: { chance: number; didCrit?: boolean },
      decision: CriticalSigilDecision
    ): void {
      for (const sigil of new Set(names.filter((name) => procs[name]?.trigger === 'crit'))) {
        const claim = decision.procs.find((proc) => proc.name === sigil);
        rows.push({
          causeEventOrder: event.eventOrder ?? null,
          at: event.at,
          sigil,
          ...critical,
          claimed: claim != null,
          ...(claim ? { readyAt: claim.readyAt } : {})
        });
      }
    },
    suppress(event: SimulationEvent, reason: SigilSuppressionReason, names: readonly string[] = []): void {
      // Rejected effects retain the claim already made by their accepted cause; rejected hits make no draw or claim.
      if (event.sigilCauseEventOrder != null) {
        for (const row of rows)
          if (
            row.causeEventOrder === event.sigilCauseEventOrder &&
            event.sourceId === `sigil.${row.sigil.toLowerCase()}`
          )
            row.suppression = reason;
      } else if (event.type === 'damage') {
        for (const sigil of new Set(names.filter((name) => procs[name]?.trigger === 'crit')))
          rows.push({
            causeEventOrder: event.eventOrder ?? null,
            at: event.at,
            sigil,
            claimed: false,
            suppression: reason
          });
      }
    },
    results(): CriticalSigilDiagnostic[] {
      return rows.map((row) => ({ ...row })).sort((a, b) => a.at - b.at);
    }
  };
}

export type CriticalSigilDiagnostics = ReturnType<typeof createCriticalSigilDiagnostics>;
