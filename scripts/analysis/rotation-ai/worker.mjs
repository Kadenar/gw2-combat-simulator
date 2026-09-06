import { parentPort, workerData } from 'node:worker_threads';
import { createEvaluator } from './engine.mjs';

// This module is only launched by pool.mjs; it has no filesystem or application state writes.
const evaluator = await createEvaluator(workerData.scenario);
parentPort.on('message', ({ id, rotation, options }) => {
  parentPort.postMessage({ id, result: evaluator.evaluate(rotation, options) });
});
