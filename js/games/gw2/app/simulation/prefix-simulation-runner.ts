/** Coalesces insertion queries in a worker; stale or missing projections never become palette availability. */
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { CombatPreviewSimulationRequest } from '#gw2/app/simulation/types.js';
import type { CombatPrefixOutcome, CombatPrefixState } from '#gw2/platform/simulation/combat-engine-adapter/prefix.js';
import { combatPreviewRequest } from '#gw2/app/simulation/preview-request.js';

export class PrefixSimulationRunner {
  status: 'idle' | 'pending' | 'ready' | 'error' = 'idle';
  error = '';
  private key: string | null = null;
  private projection: CombatPrefixState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private worker: Worker | null = null;
  private requestId = 0;

  constructor(
    private readonly app: ProfessionAppState,
    private readonly onUpdate: () => void
  ) {}

  private currentKey(): string | null {
    const selection = this.app.previewSelection;
    if (!selection) return null;
    return JSON.stringify([
      this.app.gameId,
      this.app.contentId,
      this.app.workspace?.activeTabId,
      this.app.buildRevision,
      this.app.rotationInsertionIndex ?? this.app.build.rotation.length,
      selection,
      this.app.patchId,
      this.app.build.assumptions.simulationMode
    ]);
  }

  current(): CombatPrefixState | null {
    return this.status === 'ready' && this.key === this.currentKey() ? this.projection : null;
  }

  message(): string {
    return this.key === this.currentKey() && this.status === 'error' ? this.error : 'Calculating insertion state…';
  }

  /** Capture immutable input after edits settle; replacing a busy worker actually interrupts the synchronous tick loop. */
  refresh(): void {
    const key = this.currentKey();
    if (key === null) {
      this.cancel();
      return;
    }

    if (key === this.key) return;
    this.key = key;
    this.projection = null;
    this.status = 'pending';
    this.error = '';
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (key !== this.currentKey()) {
        this.refresh();
        return;
      }

      this.worker?.terminate();
      this.worker = null;
      const requestId = ++this.requestId;
      const revision = this.app.buildRevision;
      const selection = this.app.previewSelection!;
      const fail = (error: unknown) => {
        if (key !== this.currentKey() || requestId !== this.requestId) return;
        this.status = 'error';
        this.error = error instanceof Error ? error.message : String(error);
        this.onUpdate();
      };

      try {
        if (typeof Worker !== 'function') throw new Error('Preview insertion state requires Web Workers.');
        const request: CombatPreviewSimulationRequest = {
          ...combatPreviewRequest(this.app),
          operation: 'prefix',
          insertionIndex: this.app.rotationInsertionIndex ?? this.app.build.rotation.length
        };
        const worker = new Worker(new URL('./baseline-simulation-worker.js', import.meta.url), { type: 'module' });
        this.worker = worker;
        worker.addEventListener(
          'message',
          ({
            data
          }: MessageEvent<{ requestId: number; revision: number; output?: CombatPrefixOutcome; error?: string }>) => {
            if (
              this.worker !== worker ||
              requestId !== this.requestId ||
              key !== this.currentKey() ||
              data.requestId !== requestId ||
              data.revision !== revision
            )
              return;
            worker.terminate();
            this.worker = null;
            const outcome = data.output;
            if (!outcome?.ok) {
              fail(data.error ?? (outcome && outcome.message) ?? 'Prefix projection failed.');
              return;
            }

            if (
              outcome.output !== 'prefix' ||
              outcome.identity.engine !== 'gw2.combat-engine' ||
              outcome.identity.mode !== 'detailed' ||
              outcome.identity.stepMs !== 1 ||
              outcome.identity.contentRevision !== selection.contentRevision ||
              outcome.identity.seed !== (selection.seed ?? 1) ||
              outcome.state.insertionIndex !== request.insertionIndex
            ) {
              fail('Prefix worker returned mismatched simulation identity.');
              return;
            }

            this.projection = outcome.state;
            this.status = 'ready';
            this.onUpdate();
          }
        );
        worker.addEventListener('error', (event) => {
          if (this.worker !== worker) return;
          worker.terminate();
          this.worker = null;
          fail(event.message || 'Prefix worker failed.');
        });
        worker.postMessage({ requestId, revision, request });
      } catch (error) {
        this.worker?.terminate();
        this.worker = null;
        fail(error);
      }
    }, 40);
  }

  cancel(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.key = null;
    this.projection = null;
    this.status = 'idle';
    this.error = '';
  }
}
