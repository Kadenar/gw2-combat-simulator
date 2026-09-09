import type { createGroupedOptimizer } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-space.js';
import type { createFastOptimizer } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-fast.js';
import type { GearOptimizerRequest, OptimizerCandidate } from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';

export type GearOptimizerWorkerRequest = { readonly requestId: number } & (
  | { readonly kind: 'init'; readonly request: GearOptimizerRequest }
  | { readonly kind: 'chunk'; readonly chunkId: number; readonly start: string; readonly end: string }
  | { readonly kind: 'verify'; readonly candidates: readonly OptimizerCandidate[] }
  | { readonly kind: 'refine'; readonly candidates: readonly OptimizerCandidate[] }
);

let activeId = -1;
let job: ReturnType<typeof createGroupedOptimizer> | ReturnType<typeof createFastOptimizer> | null = null;

/** Each worker validates and prepares once, then evaluates bounded ranges until its owner terminates it. */
self.addEventListener('message', async ({ data }: MessageEvent<GearOptimizerWorkerRequest>) => {
  const post = (payload: object): void => self.postMessage({ requestId: data.requestId, ...payload });
  try {
    // Keep shared code out of the entry chunk so WebKit cannot reimport it and install an uninitialized listener.
    const { optimizerEquipment, optimizerScore, verifyOptimizerScore } =
      await import('#gw2/app/simulation/gear-optimizer/gear-optimizer.js');
    if (data.kind === 'init') {
      activeId = data.requestId;
      const [{ loadProfessionAppAdapter }, { createGroupedOptimizer }, { createFastOptimizer }] = await Promise.all([
        import('#gw2/app/profession/registry.js'),
        import('#gw2/app/simulation/gear-optimizer/gear-optimizer-space.js'),
        import('#gw2/app/simulation/gear-optimizer/gear-optimizer-fast.js')
      ]);
      const adapter = await loadProfessionAppAdapter(data.request.contentId);
      if (!adapter) throw new TypeError('Optimizer profession is unavailable.');
      if (activeId !== data.requestId) return;
      job =
        data.request.search === 'fast'
          ? createFastOptimizer(data.request, adapter)
          : createGroupedOptimizer(data.request, adapter);
      const baseline = optimizerScore(job.evaluator.evaluate(optimizerEquipment(data.request.build)));
      post({
        kind: 'ready',
        count: job.space.count.toString(),
        rawCount: job.space.ordinary.rawCount.toString(),
        baseline
      });
      return;
    }

    if (data.requestId !== activeId || !job) throw new TypeError('Optimizer worker is not initialized.');
    // Every worker derives the same bounded round from the merged winners before ranges are divided again.
    if (data.kind === 'refine') {
      if (!('refine' in job) || data.candidates.length > 20) throw new TypeError('Invalid optimizer refinement.');
      job.refine(data.candidates);
      post({ kind: 'ready', count: job.space.count.toString(), rawCount: job.space.ordinary.rawCount.toString() });
      return;
    }

    if (data.kind === 'chunk') {
      if (!Number.isSafeInteger(data.chunkId) || !/^\d+$/.test(data.start) || !/^\d+$/.test(data.end))
        throw new TypeError('Invalid optimizer chunk identity.');
      const started = performance.now();
      const result = job.evaluateRange(BigInt(data.start), BigInt(data.end));
      post({ kind: 'chunk', chunkId: data.chunkId, ...result, elapsedMs: performance.now() - started });
      return;
    }

    if (data.kind !== 'verify' || data.candidates.length > 20)
      throw new TypeError('Invalid optimizer verification request.');
    for (const candidate of data.candidates) {
      const detailed = job.evaluator.evaluate(candidate.equipment);
      verifyOptimizerScore(candidate.score, optimizerScore(detailed));
    }

    post({ kind: 'verified' });
  } catch (error) {
    post({ error: error instanceof Error ? error.message : String(error) });
  }
});
