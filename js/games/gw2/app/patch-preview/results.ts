/** Retains visited patch results by captured input identity, independently of application state. */
import type { BaselineSimulationResult, PatchComparison } from '#gw2/app/simulation/baseline/types.js';

export interface PatchResultIdentity {
  readonly build: object;
  readonly selectedPatchId: string;
  readonly previewId: string | null;
  readonly environment: string;
  readonly values: string;
  readonly builds: Readonly<Record<string, string>>;
  readonly damageDiagnostics: boolean;
  readonly scenario: boolean;
}

/** The lifecycle alone admits cache writes; snapshots capture keys before asynchronous work begins. */
export class PatchResultCache<T extends BaselineSimulationResult> {
  private readonly visited = new WeakMap<
    object,
    {
      environment: string;
      results: Map<string, { result: T; values: string; build: string }>;
    }
  >();

  invalidate(build: object): void {
    this.visited.delete(build);
  }

  private saved(identity: PatchResultIdentity, patchId: string): T | null {
    if (identity.scenario) return null;

    const cache = this.visited.get(identity.build);

    if (!cache || cache.environment !== identity.environment) return null;

    const saved = cache.results.get(patchId);

    if (!saved || saved.build !== identity.builds[patchId]) return null;

    if (patchId !== 'current' && saved.values !== identity.values) return null;

    return saved.result;
  }

  reusable(identity: PatchResultIdentity): T | null {
    if (!identity.previewId) return null;

    const result = this.saved(identity, identity.selectedPatchId);
    return result && Boolean(result.debugInputs) === identity.damageDiagnostics ? result : null;
  }

  record(identity: PatchResultIdentity, result: T, patchId = identity.selectedPatchId): void {
    if (!identity.previewId || identity.scenario) return;

    let cache = this.visited.get(identity.build);

    if (!cache || cache.environment !== identity.environment) {
      cache = { environment: identity.environment, results: new Map() };
      this.visited.set(identity.build, cache);
    }

    cache.results.set(patchId, { result, values: identity.values, build: identity.builds[patchId] });
  }

  comparison(identity: PatchResultIdentity): PatchComparison | null {
    if (!identity.previewId || identity.scenario) return null;

    const current = this.saved(identity, 'current');
    const preview = this.saved(identity, identity.previewId);
    return current && preview ? { current, preview } : null;
  }

  needsComparison(identity: PatchResultIdentity): boolean {
    if (!identity.previewId || identity.scenario) return false;

    return !this.saved(identity, identity.selectedPatchId === 'current' ? identity.previewId : 'current');
  }
}
