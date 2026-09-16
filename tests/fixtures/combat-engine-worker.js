/** Runs one combat-engine request inside a worker thread to prove headless execution. */
import { parentPort, workerData } from 'node:worker_threads';

import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';

parentPort.postMessage(runCombatEngine(workerData));
