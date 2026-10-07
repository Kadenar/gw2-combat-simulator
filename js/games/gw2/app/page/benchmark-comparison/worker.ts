import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import type { ComparisonRequest } from '#gw2/app/page/benchmark-comparison/model.js';

const prepared = new Map<string, ComparisonRequest>();

/** Prepare and simulate inside the worker; successful immutable preset inputs stay cached for subsequent runs. */
self.addEventListener('message', async ({ data }: MessageEvent<{ requestId: number; row: Benchmark }>) => {
  try {
    // Load shared modules after entry initialization, matching the optimizer's worker-loading contract.
    const [{ loadComparisonRequest }, { comparisonKey, comparisonResult }, { simulateGw2 }, { loadGw2WorkerDriver }] =
      await Promise.all([
        import('#gw2/app/page/benchmark-comparison/request.js'),
        import('#gw2/app/page/benchmark-comparison/model.js'),
        import('#gw2/platform/simulation/simulate.js'),
        import('#gw2/worker-driver.js')
      ]);
    const key = comparisonKey(data.row);
    let request = prepared.get(key);
    if (!request) {
      request = await loadComparisonRequest(data.row);
      prepared.set(key, request);
    }

    const profession = await loadGw2WorkerDriver(request.contentId);
    if (!profession) throw new Error(`Unknown profession: ${request.contentId}`);
    const result = comparisonResult(
      simulateGw2({ profession, rotation: request.rotation, config: request.config, collectChartData: false })
    );
    self.postMessage({ requestId: data.requestId, result });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: error instanceof Error ? error.message : String(error) });
  }
});
