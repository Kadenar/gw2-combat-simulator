/** Worker producers and consumers must agree on required fields while error replies remain distinct from success. */
import type { OptimizerResultGroups } from '#gw2/app/optimizer/gear/candidate-results.js';
import type { GearOptimizerRequest, OptimizerCandidate, OptimizerScore } from '#gw2/app/optimizer/gear/search.js';
import type {
  GearOptimizerWorkerPayload,
  GearOptimizerWorkerRequest,
  GearOptimizerWorkerResponse
} from '#gw2/app/optimizer/gear/worker-protocol.js';

export function checkOptimizerMessages(
  post: (payload: GearOptimizerWorkerPayload) => void,
  send: (message: GearOptimizerWorkerRequest) => void,
  request: GearOptimizerRequest,
  baseline: OptimizerScore,
  candidates: OptimizerCandidate[],
  groups: OptimizerResultGroups
): void {
  send({ kind: 'init', requestId: 1, request, bootstrap: true });
  send({ kind: 'chunk', requestId: 1, chunkId: 1, start: '0', end: '1' });
  send({ kind: 'verify', requestId: 1, candidates });
  send({ kind: 'refine', requestId: 1, candidates });
  post({ kind: 'ready', count: '1', rawCount: '2', baseline });
  post({ kind: 'ready', count: '1', rawCount: '2' });
  const progress = { chunkId: 1, completed: '1', representedCombinationCount: '2', simulations: '1' };
  post({ kind: 'progress', ...progress });
  const chunk = { kind: 'chunk' as const, ...progress, winners: candidates, groups, warnings: [], elapsedMs: 150 };
  post(chunk);
  post({ kind: 'verified' });
  post({ error: 'Worker failed.' });

  // @ts-expect-error Initialization must declare whether this worker owns bootstrap validation.
  send({ kind: 'init', requestId: 1, request });
  // @ts-expect-error A chunk command needs an end bound.
  send({ kind: 'chunk', requestId: 1, chunkId: 1, start: '0' });
  // @ts-expect-error Verification needs its candidate batch.
  send({ kind: 'verify', requestId: 1 });
  // @ts-expect-error Readiness must report the raw space count as well as the current round.
  post({ kind: 'ready', count: '1' });
  // @ts-expect-error Progress must include all counters.
  post({ kind: 'progress', chunkId: 1, completed: '1' });
  // @ts-expect-error Chunk completion requires result collections and elapsed time, even for empty results.
  post({ kind: 'chunk', ...progress });
  // @ts-expect-error Required result groups cannot be replaced by an absent collection.
  post({ ...chunk, groups: undefined });
  // @ts-expect-error Error replies cannot also claim successful verification.
  post({ kind: 'verified', error: 'Worker failed.' });
}

export function checkOptimizerResponse(message: GearOptimizerWorkerResponse): string | number {
  const requestId: number = message.requestId;

  if (message.error !== undefined) return message.error;

  switch (message.kind) {
    case 'ready': {
      const count: string = message.count;
      // @ts-expect-error Ready replies do not carry candidate winners.
      message.winners;
      return count;
    }

    case 'progress':
      return message.simulations;
    case 'chunk':
      return message.winners.length + message.groups.all.length + message.warnings.length + message.elapsedMs;
    case 'verified':
      return requestId;
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}
