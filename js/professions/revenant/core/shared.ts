/**
 * Shared Revenant mechanic primitives.
 *
 * Provides the canonical scheduler-to-resolver state handoff. State events
 * always contain a detached snapshot so later scheduler mutations cannot
 * rewrite earlier timeline state.
 */
import { snapshotRevenantState } from '../state.js';
import type { RevenantSchedulerContext } from '../types.js';

/** Emits a point-in-time profession snapshot for resolver synchronization. */
export function emitRevenantState(context: RevenantSchedulerContext, at: number, reason: string): void {
  context.emit({
    type: 'revenant.state',
    at,
    source: 'revenant',
    sourceId: `revenant.state.${reason}`,
    actorType: 'player',
    reason,
    state: snapshotRevenantState(context.state.profession)
  });
}
