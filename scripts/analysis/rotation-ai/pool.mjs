import { Worker } from 'node:worker_threads';

export class SimulationPool {
  constructor(scenario, size = 1, timeoutMs = 30000) {
    this.queue = [];
    this.nextId = 0;
    this.closed = false;
    this.failure = null;
    this.timeoutMs = timeoutMs;
    this.workers = Array.from({ length: size }, () => {
      const slot = {
        worker: new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { scenario } }),
        job: null
      };
      slot.worker.on('message', ({ id, result }) => {
        if (slot.job?.id !== id) return;
        clearTimeout(slot.job.timer);
        slot.job.resolve(result);
        slot.job = null;
        this.dispatch();
      });
      slot.worker.on('error', (error) => this.fail(error));
      slot.worker.on('exit', (code) => {
        if (!this.closed) this.fail(new Error(`Simulation worker exited unexpectedly (${code}).`));
      });
      return slot;
    });
  }

  evaluate(rotation, options = {}) {
    if (this.closed) return Promise.reject(this.failure || new Error('Simulation pool is closed.'));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, rotation, options, resolve, reject });
      this.dispatch();
    });
  }

  dispatch() {
    for (const slot of this.workers) {
      if (slot.job || !this.queue.length) continue;
      slot.job = this.queue.shift();
      slot.job.timer = setTimeout(
        () =>
          this.fail(
            new Error(
              `A simulation exceeded ${this.timeoutMs / 1000}s. Progress from completed batches is saved; reduce command count or use --timeout.`
            )
          ),
        this.timeoutMs
      );
      slot.worker.postMessage({ id: slot.job.id, rotation: slot.job.rotation, options: slot.job.options });
    }
  }

  fail(error) {
    if (this.closed) return;
    this.failure = error;
    this.closed = true;
    for (const slot of this.workers) {
      if (slot.job) {
        clearTimeout(slot.job.timer);
        slot.job.reject(error);
        slot.job = null;
      }

      void slot.worker.terminate();
    }

    for (const job of this.queue.splice(0)) job.reject(error);
  }

  async close() {
    this.fail(new Error('Simulation pool closed.'));
    await Promise.all(this.workers.map((slot) => slot.worker.terminate()));
  }
}
