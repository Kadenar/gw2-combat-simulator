import type { GameContentAddress } from '#browser/game/contracts.js';
import { loadGameWorkerDriver } from '#browser/game/worker-driver.js';

export interface GameWorkerRequestEnvelope<TRequest extends GameContentAddress> {
  readonly requestId: number;
  readonly request: TRequest;
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
