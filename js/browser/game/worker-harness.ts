import type { GameContentAddress } from '#browser/game/contracts.js';
import { loadGameWorkerDriver } from '#browser/game/worker-driver.js';

export interface GameWorkerRequestEnvelope<TRequest extends GameContentAddress> {
  readonly requestId: number;
  readonly request: TRequest;
}

export interface GameWorkerResponseEnvelope {
  readonly requestId: number;
  readonly error?: string;
}

interface DedicatedWorkerScope<TMessage> {
  addEventListener(type: 'message', listener: (event: MessageEvent<TMessage>) => void): void;
  postMessage(message: unknown): void;
}

interface GameWorkerEndpointOptions<TDriver, TMessage extends GameWorkerRequestEnvelope<GameContentAddress>> {
  readonly calculate: (
    driver: TDriver,
    message: TMessage,
    postUpdate: (payload: object) => void
  ) => object | Promise<object>;
}

/** Loads only the selected game's worker driver so endpoints stay game and content neutral. */
async function loadWorkerDriver<TDriver>({ gameId, contentId }: GameContentAddress): Promise<TDriver | null> {
  return (await loadGameWorkerDriver({ gameId, contentId })) as TDriver | null;
}

/** Installs the shared worker protocol with stable job identity and serialized errors. */
export function createGameWorkerEndpoint<TDriver, TMessage extends GameWorkerRequestEnvelope<GameContentAddress>>({
  calculate
}: GameWorkerEndpointOptions<TDriver, TMessage>): void {
  // Endpoints use the worker global and shared loader so every job follows the production loading path.
  const scope = self as unknown as DedicatedWorkerScope<TMessage>;
  scope.addEventListener('message', async ({ data }) => {
    const post = (payload: object): void => {
      // Progress, results, and errors share the submitted job identity.
      scope.postMessage({ ...payload, requestId: data.requestId });
    };

    try {
      const { gameId, contentId } = data.request;
      const driver = await loadWorkerDriver<TDriver>({ gameId, contentId });

      if (!driver) throw new Error(`No worker driver for ${gameId}/${contentId}.`);

      post(await calculate(driver, data, post));
    } catch (error) {
      post({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

type ManagedWorkerMessageHandler<TMessage> = (message: TMessage, worker: Worker) => void;
type ManagedWorkerFactory = () => Worker;

/** Owns a request's workers so stale, completed, and failed jobs share one cleanup path. */
export class ManagedWorkerBatch<TMessage extends GameWorkerResponseEnvelope> {
  private readonly workers = new Set<Worker>();
  private activeRequestId: number | null = null;
  private onError: (error: unknown) => void = () => {};

  get isRunning(): boolean {
    return this.workers.size > 0;
  }

  begin(requestId: number, onError: (error: unknown) => void): void {
    this.terminateAll();
    this.activeRequestId = requestId;
    this.onError = onError;
  }

  isActive(requestId: number): boolean {
    return this.activeRequestId === requestId;
  }

  /** Starts an active request's worker and passes its handle to the response callback for follow-up or cleanup. */
  spawn(
    createWorker: ManagedWorkerFactory,
    requestId: number,
    request: unknown,
    onMessage: ManagedWorkerMessageHandler<TMessage>
  ): void {
    if (!this.isActive(requestId)) return;

    let worker: Worker;
    try {
      worker = createWorker();
    } catch (error) {
      this.fail(requestId, error);
      return;
    }

    this.workers.add(worker);
    worker.addEventListener('message', (event: MessageEvent<TMessage>) => {
      if (!this.workers.has(worker) || !this.isActive(requestId) || event.data.requestId !== requestId) return;

      if (event.data.error !== undefined) {
        this.fail(requestId, event.data.error);
        return;
      }

      try {
        onMessage(event.data, worker);
      } catch (error) {
        this.fail(requestId, error);
      }
    });
    worker.addEventListener(
      'error',
      (event) => {
        if (!this.workers.has(worker) || !this.isActive(requestId)) return;

        // Browsers can omit crash details (for example, module load failures); keep the failure actionable.
        this.fail(
          requestId,
          event.error ?? (event.message || 'Worker failed to load or run. Reload the page and try again.')
        );
      },
      { once: true }
    );

    try {
      worker.postMessage(request);
    } catch (error) {
      this.fail(requestId, error);
    }
  }

  finish(worker: Worker): void {
    if (!this.workers.delete(worker)) return;

    worker.terminate();
  }

  terminateAll(): void {
    for (const worker of this.workers) worker.terminate();
    this.workers.clear();
  }

  private fail(requestId: number, error: unknown): void {
    if (!this.isActive(requestId)) return;

    // Clear the request identity before cleanup so failed jobs cannot accept further work or responses.
    this.activeRequestId = null;
    this.terminateAll();
    this.onError(error);
  }
}
