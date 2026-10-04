import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { createProcRegistry } from '#gw2/platform/combat/procs.js';

const PROCS = SIGIL_PROCS as Readonly<Record<number, Gw2SigilProc>>;

interface CriticalSigilIntent {
  readonly id: number;
  readonly readyAt: number;
}

export interface CriticalSigilDecision {
  readonly procs: readonly CriticalSigilIntent[];
}

/** Authored trigger membership also determines resolver ownership, including Blight. */
function isCriticalSigil(id: number): boolean {
  return PROCS[id]?.trigger === 'crit';
}

/** Decide from phase-local facts without mutating state or drawing another critical outcome. */
export function decideCriticalSigils(
  event: SimulationEvent,
  ids: readonly number[],
  critical: { readonly chance: number; readonly didCrit?: boolean },
  procs: Pick<ReturnType<typeof createProcRegistry>, 'deadline'>
): CriticalSigilDecision {
  const next = { procs: [] as CriticalSigilIntent[] };
  const active = [...new Set(ids.filter(isCriticalSigil))];
  if (
    !active.length ||
    event.type !== 'damage' ||
    event.cancelled === true ||
    missesTarget(event) ||
    !(Number(event.coefficient) > 0) ||
    event.canCrit === false ||
    Number.isFinite(event.flatDamage) ||
    Number.isFinite(event.flatStrikeBase) ||
    Number.isFinite(event.flatStrikePowerCoeff) ||
    (!isGw2PlayerActorEvent(event) && event.canTriggerCriticalSigils !== true) ||
    !(critical.chance > 0)
  )
    return next;

  // The shared seeded hit outcome decides eligibility in both modes; ICDs stay blocked through their deadline.
  if (critical.didCrit !== true) return next;
  for (const id of active) {
    if (isInternalCooldownReady(event.at, procs.deadline(`sigil.${id}`))) {
      next.procs.push({ id, readyAt: event.at + PROCS[id].cooldown });
    }
  }

  return next;
}
