// Compatibility barrel for callers migrating from profession-only worker routing.
export {
  createGameWorkerEndpoint as createProfessionWorkerEndpoint,
  ManagedWorkerBatch
} from './game-worker-harness.js';
export type {
  GameWorkerRequestEnvelope as ProfessionWorkerRequestEnvelope,
  GameWorkerResponseEnvelope as ProfessionWorkerResponseEnvelope
} from './game-worker-harness.js';
