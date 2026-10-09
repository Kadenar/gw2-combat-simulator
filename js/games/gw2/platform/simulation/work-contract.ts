import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { QueuedEvent } from '#kernel/events/queue.js';

export type RuntimeWork =
  | InternalWork<'runtime.allied-strike', { sequence: number }>
  | InternalWork<
      'runtime.announcement',
      {
        request: import('#gw2/platform/effects/emission.js').AnnouncementEmission;
        event: SimulationEventBase;
      }
    >
  | InternalWork<'runtime.flip-expiry', { skillId: SkillId; identity: number | string }>
  | InternalWork<'runtime.complete', { reservationId: string }>
  | InternalWork<
      'runtime.cast-task',
      { name: string; cast: Omit<RuntimeCast, 'skill'>; skillId: SkillId; data: Record<string, unknown> }
    >
  | InternalWork<'runtime.task', { name: string; data: unknown }>;

/** A lifetime is separate from cast attribution: committed projectiles can outlive their originating cast. */
export interface WorkOwner {
  readonly id: string;
  readonly generation: number;
}

/** Concrete handlers specialize type and payload into a discriminated union; internal work is never a log packet. */
export interface InternalWork<TType extends string = string, TPayload = unknown> extends QueuedEvent {
  readonly kind: 'internal';
  readonly type: TType;
  readonly at: number;
  readonly priority: number;
  readonly payload: TPayload;
  readonly activationId?: string;
  readonly owner?: WorkOwner;
}

export type WorkInput<TWork extends InternalWork> = TWork extends InternalWork
  ? Pick<TWork, 'type' | 'at' | 'priority' | 'payload' | 'activationId' | 'owner' | 'causalOrder'>
  : never;
