import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';

const PROCS = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;

export interface CriticalSigilIntent {
  readonly name: string;
  readonly readyAt: number;
}

export interface CriticalSigilDecision {
  readonly procs: readonly CriticalSigilIntent[];
}

/** Authored trigger membership also determines resolver ownership, including Blight. */
function isCriticalSigil(name: string): boolean {
  return PROCS[name]?.trigger === 'crit';
}

/** Decide from phase-local facts without mutating state or drawing another critical outcome. */
export function decideCriticalSigils(
  event: SimulationEvent,
  names: readonly string[],
  critical: { readonly chance: number; readonly didCrit?: boolean },
  state: { readonly readyAt: ReadonlyMap<string, number> }
): CriticalSigilDecision {
  const next = { procs: [] as CriticalSigilIntent[] };
  const active = [...new Set(names.filter(isCriticalSigil))];
  if (
    !active.length ||
    event.type !== 'damage' ||
    event.cancelled === true ||
    missesTarget(event) ||
    !(Number(event.coefficient) > 0) ||
    event.noCrit === true ||
    Number.isFinite(event.flatDamage) ||
    Number.isFinite(event.flatStrikeBase) ||
    Number.isFinite(event.flatStrikePowerCoeff) ||
    (!isGw2PlayerActorEvent(event) && event.canTriggerCriticalSigils !== true) ||
    !(critical.chance > 0)
  )
    return next;

  // The shared seeded hit outcome decides eligibility in both modes; ICDs stay blocked through their deadline.
  if (critical.didCrit !== true) return next;
  for (const name of active) {
    if (isInternalCooldownReady(event.at, state.readyAt.get(name) ?? 0)) {
      next.procs.push({ name, readyAt: event.at + PROCS[name].cooldown });
    }
  }

  return next;
}
