import type { SkillDamagePlan } from '#gw2/app/build/skill-damage/plan.js';
import type { SkillDamageEvaluation } from '#gw2/platform/skill-damage/types.js';

interface SkillDamageJob {
  readonly requestId: number;
  readonly signature: string;
  readonly request: SkillDamagePlan['request'];
}

interface SkillDamageWorkerMessage {
  readonly requestId: number;
  readonly evaluation?: SkillDamageEvaluation;
  readonly error?: unknown;
}

export type SkillDamageListener = (signature: string, evaluation: SkillDamageEvaluation | null, error: string) => void;

// Long enough to coalesce typing in a number input; short enough that a toggle feels immediate.
const SKILL_DAMAGE_DEBOUNCE_MS = 150;

/**
 * Keeps one warm worker and at most one job in flight. A newer plan replaces any queued one, and only the latest
 * request's answer is published, so a slow evaluation can never overwrite a newer preview.
 */
export class SkillDamageRunner {
  private readonly onResult: SkillDamageListener;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private worker: Worker | null = null;
  private pending: SkillDamageJob | null = null;
  private inFlight: SkillDamageJob | null = null;
  private requestId = 0;

  constructor(onResult: SkillDamageListener) {
    this.onResult = onResult;
  }

  get isRunning(): boolean {
    return this.pending != null || this.inFlight != null;
  }

  schedule(plan: SkillDamagePlan): void {
    // An identical queued or running request will publish the same answer.
    if ((this.pending ?? this.inFlight)?.signature === plan.signature) return;
    this.pending = { requestId: ++this.requestId, signature: plan.signature, request: plan.request };
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.startPending();
    }, SKILL_DAMAGE_DEBOUNCE_MS);
  }

  /** Abandons queued and running work, keeping an idle worker warm for the next preview. */
  cancel(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    if (this.inFlight) {
      this.worker?.terminate();
      this.worker = null;
    }

    this.inFlight = null;
  }

  private startPending(): void {
    if (this.inFlight || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.inFlight = job;
    let worker = this.worker;
    try {
      worker ||= this.createWorker();
      worker.postMessage({ requestId: job.requestId, request: job.request });
    } catch (error) {
      worker?.terminate();
      if (this.worker === worker) this.worker = null;
      this.finish(job, { requestId: job.requestId, error });
    }
  }

  private createWorker(): Worker {
    // Keep Worker construction beside its static URL so Vite emits an executable worker chunk.
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<SkillDamageWorkerMessage>) => {
      if (this.worker !== worker) return;
      const job = this.inFlight;
      if (!job || event.data.requestId !== job.requestId) return;
      this.finish(job, event.data);
    });
    worker.addEventListener('error', (event) => {
      if (this.worker !== worker) return;
      const job = this.inFlight;
      worker.terminate();
      this.worker = null;
      if (job) this.finish(job, { requestId: job.requestId, error: event.error ?? event.message });
    });
    this.worker = worker;
    return worker;
  }

  private finish(job: SkillDamageJob, message: SkillDamageWorkerMessage): void {
    if (this.inFlight?.requestId !== job.requestId) return;
    this.inFlight = null;
    if (job.requestId === this.requestId) {
      const error =
        message.evaluation || message.error == null
          ? ''
          : message.error instanceof Error
            ? message.error.message
            : String(message.error);
      this.onResult(
        job.signature,
        message.evaluation ?? null,
        error || (message.evaluation ? '' : 'Skill damage could not be measured.')
      );
    }

    if (this.pending) this.startPending();
  }
}
