import { LatestWorkerQueue } from '#browser/game/latest-worker-queue.js';
import type { SkillDamagePlan } from '#gw2/app/build/skill-damage/plan.js';
import type { SkillDamageEvaluation } from '#gw2/platform/skill-damage/types.js';

interface SkillDamageWorkerMessage {
  readonly requestId: number;
  readonly evaluation?: SkillDamageEvaluation;
  readonly error?: unknown;
}

export type SkillDamageListener = (signature: string, evaluation: SkillDamageEvaluation | null, error: string) => void;

// Coalesce typing while keeping toggles responsive.
const SKILL_DAMAGE_DEBOUNCE_MS = 150;

/** Signature deduplication belongs to the preview; request ordering and warm-worker reuse belong to the queue. */
export class SkillDamageRunner {
  private readonly queue: LatestWorkerQueue<SkillDamagePlan, SkillDamageWorkerMessage>;

  constructor(onResult: SkillDamageListener) {
    this.queue = new LatestWorkerQueue({
      debounceMs: SKILL_DAMAGE_DEBOUNCE_MS,
      createWorker: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
      onResult: (job, message) =>
        onResult(
          job.signature,
          message.evaluation ?? null,
          message.evaluation ? '' : 'Skill damage could not be measured.'
        ),
      onError: (job, error) =>
        onResult(
          job.signature,
          null,
          (error instanceof Error ? error.message : String(error ?? '')) || 'Skill damage could not be measured.'
        )
    });
  }

  get isRunning(): boolean {
    return this.queue.isRunning;
  }

  schedule(plan: SkillDamagePlan): void {
    if ((this.queue.pending ?? this.queue.inFlight)?.signature === plan.signature) return;

    this.queue.schedule(plan);
  }

  /** Abandons waiting edits without terminating an active measurement or its warm worker. */
  discardQueued(): void {
    this.queue.discardQueued();
  }

  cancel(): void {
    this.queue.cancel();
  }
}
