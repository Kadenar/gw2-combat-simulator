import { loadProfessionAppAdapter } from '../profession/registry.js';
import type { Gw2AppAdapter } from '../profession/types.js';

export interface ProfessionWorkerRequestEnvelope<TRequest extends { readonly professionId: string }> {
  readonly requestId: number;
  readonly request: TRequest;
}

export interface ProfessionWorkerResponseEnvelope {
  readonly requestId: number;
  readonly error?: string;
}

interface DedicatedWorkerScope<TMessage> {
  addEventListener(type: 'message', listener: (event: MessageEvent<TMessage>) => void): void;
  postMessage(message: unknown): void;
}

interface ProfessionWorkerEndpointOptions<
  TMessage extends ProfessionWorkerRequestEnvelope<{ readonly professionId: string }>
> {
  readonly calculate: (
    adapter: Gw2AppAdapter,
    message: TMessage,
    postUpdate: (payload: object) => void
  ) => object | Promise<object>;
  readonly echo?: (message: TMessage) => object;
  readonly loadAdapter?: (professionId: string) => Promise<Gw2AppAdapter | null>;
  readonly scope?: DedicatedWorkerScope<TMessage>;
}

/**
 * Installs the common profession-worker protocol so every endpoint loads its
 * adapter and returns request identity and serializable errors consistently.
 */
export function createProfessionWorkerEndpoint<
  TMessage extends ProfessionWorkerRequestEnvelope<{ readonly professionId: string }>
>({
  calculate,
  echo = () => ({}),
  loadAdapter = loadProfessionAppAdapter,
  scope = self as unknown as DedicatedWorkerScope<TMessage>
}: ProfessionWorkerEndpointOptions<TMessage>): void {
  scope.addEventListener('message', async ({ data }) => {
    const post = (payload: object): void => {
      scope.postMessage({ ...echo(data), ...payload, requestId: data.requestId });
    };

    try {
      const adapter = await loadAdapter(data.request.professionId);
      if (!adapter) throw new Error(`No application adapter for ${data.request.professionId}.`);
      post(await calculate(adapter, data, post));
    } catch (error) {
      post({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

type ManagedWorkerMessageHandler<TMessage> = (message: TMessage, worker: Worker) => void;
type ManagedWorkerFactory = () => Worker;

/**
 * Owns one pooled request's workers so superseded responses are ignored and
 * every completed or failed worker is terminated through the same lifecycle.
 */
export class ManagedWorkerBatch<TMessage extends ProfessionWorkerResponseEnvelope> {
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
