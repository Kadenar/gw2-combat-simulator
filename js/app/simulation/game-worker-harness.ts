import { loadGameWorkerDriver } from '../../games/worker-driver.js';
import type { GameContentAddress } from '#app/shell/types.js';

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
  readonly echo?: (message: TMessage) => object;
  readonly loadDriver?: (address: GameContentAddress) => Promise<TDriver | null>;
  readonly scope?: DedicatedWorkerScope<TMessage>;
}

/** Loads only the selected game's worker driver so endpoints stay game and content neutral. */
async function loadWorkerDriver<TDriver>({ gameId, contentId }: GameContentAddress): Promise<TDriver | null> {
  return (await loadGameWorkerDriver({ gameId, contentId })) as TDriver | null;
}

/** Installs the shared worker protocol with stable job identity and serialized errors. */
export function createGameWorkerEndpoint<TDriver, TMessage extends GameWorkerRequestEnvelope<GameContentAddress>>({
  calculate,
  echo = () => ({}),
  loadDriver = loadWorkerDriver<TDriver>,
  scope = self as unknown as DedicatedWorkerScope<TMessage>
}: GameWorkerEndpointOptions<TDriver, TMessage>): void {
  scope.addEventListener('message', async ({ data }) => {
    const post = (payload: object): void => {
      scope.postMessage({ ...echo(data), ...payload, requestId: data.requestId });
    };

    try {
      const { gameId, contentId } = data.request;
      const driver = await loadDriver({ gameId, contentId });
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
  private failed = false;
  private onError: (error: unknown) => void = () => {};

  get isRunning(): boolean {
    return this.workers.size > 0;
  }

  begin(requestId: number, onError: (error: unknown) => void): void {
    this.terminateAll();
    this.activeRequestId = requestId;
    this.failed = false;
    this.onError = onError;
  }

  isActive(requestId: number): boolean {
    return !this.failed && this.activeRequestId === requestId;
  }

  spawn(
    createWorker: ManagedWorkerFactory,
    requestId: number,
    request: unknown,
    onMessage: ManagedWorkerMessageHandler<TMessage>
  ): Worker | null {
    if (!this.isActive(requestId)) return null;

    let worker: Worker;
    try {
      worker = createWorker();
    } catch (error) {
      this.fail(requestId, error);
      return null;
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
        this.fail(requestId, event.error ?? event.message);
      },
      { once: true }
    );

    try {
      worker.postMessage(request);
    } catch (error) {
      this.fail(requestId, error);
      return null;
    }

    return worker;
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
    this.failed = true;
    this.terminateAll();
    this.onError(error);
  }
}
