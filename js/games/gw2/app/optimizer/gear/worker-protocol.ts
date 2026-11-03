/** Shared wire contracts keep optimizer commands and replies complete without importing runtime code into the worker. */
import type { OptimizerResultGroups } from '#gw2/app/optimizer/gear/candidate-results.js';
import type { GearOptimizerRequest, OptimizerCandidate, OptimizerScore } from '#gw2/app/optimizer/gear/search.js';

export type GearOptimizerWorkerRequest = { readonly requestId: number } & (
  | { readonly kind: 'init'; readonly request: GearOptimizerRequest; readonly bootstrap: boolean }
  | { readonly kind: 'chunk'; readonly chunkId: number; readonly start: string; readonly end: string }
  | { readonly kind: 'verify'; readonly candidates: readonly OptimizerCandidate[] }
  | { readonly kind: 'refine'; readonly candidates: readonly OptimizerCandidate[] }
);

interface ChunkProgress {
  readonly chunkId: number;
  readonly completed: string;
  readonly representedCombinationCount: string;
  readonly simulations: string;
}

/** Ready replies after bootstrap or refinement legitimately omit the baseline; completed chunks never omit results. */
export type GearOptimizerWorkerPayload =
  | ({ readonly error?: never } & (
      | {
          readonly kind: 'ready';
          readonly count: string;
          readonly rawCount: string;
          readonly baseline?: OptimizerScore;
        }
      | ({ readonly kind: 'progress' } & ChunkProgress)
      | ({
          readonly kind: 'chunk';
          readonly winners: readonly OptimizerCandidate[];
          readonly groups: OptimizerResultGroups;
          readonly warnings: readonly (readonly [string, number])[];
          readonly elapsedMs: number;
        } & ChunkProgress)
      | { readonly kind: 'verified' }
    ))
  | { readonly error: string };

export type GearOptimizerWorkerResponse = { readonly requestId: number } & GearOptimizerWorkerPayload;
