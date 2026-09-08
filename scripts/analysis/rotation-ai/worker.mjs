import { parentPort, workerData } from 'node:worker_threads';
import { createEvaluator } from './engine.mjs';
import { createRotationGenerator } from './generation.mjs';

// This module is only launched by pool.mjs; it has no filesystem or application state writes.
const evaluator = await createEvaluator(workerData.scenario);
let generator;
parentPort.on('message', async ({ id, rotation, options }) => {
  if (options.generationSeed != null) {
    generator ||= await createRotationGenerator(workerData.scenario);
    const generated = generator.generate(options.generationSeed);
    parentPort.postMessage({
      id,
      result: {
        ...evaluator.evaluate(generated.rotation),
        source: 'generated',
        generation: generated.generation
      }
    });
  } else {
    parentPort.postMessage({ id, result: evaluator.evaluate(rotation, options) });
  }
});
