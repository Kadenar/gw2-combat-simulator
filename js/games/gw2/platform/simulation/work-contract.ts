import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { QueuedEvent } from '#kernel/events/queue.js';
import type { WorkOwner, WorkScheduler } from '#kernel/execution/scheduling.js';

/** Reserved for flip retirement after all queued gameplay at a deadline, before the next rotation command. */
export const FLIP_EXPIRY_PRIORITY = Number.MAX_VALUE;

export type RuntimeWork =
  | InternalWork<'runtime.allied-strike', { sequence: number }>
  | InternalWork<'runtime.encounter', { generation: number }>
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

/** Packets and private work share ordering, but only packets carry gameplay source identity. */
export type RuntimeQueueEntry = Gw2ResolverEvent | RuntimeWork;

/** Packet admission reserves this kind for factory-created work, so the heap can recover its payload union. */
export function isRuntimeWork(entry: RuntimeQueueEntry): entry is RuntimeWork {
  return entry.kind === 'internal';
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
  /** Explicit grant tasks settle before tied strikes; arbitrary callbacks retain ordinary causality. */
  readonly timing?: 'buffs' | 'expiry';
}

export type WorkInput<TWork extends InternalWork> = TWork extends InternalWork
  ? Pick<TWork, 'type' | 'at' | 'priority' | 'payload' | 'activationId' | 'owner' | 'causalOrder' | 'timing'>
  : never;

/** Mechanics schedule owned work without obtaining the queue or advancing its clock. */
export interface TaskScheduling<TSkill extends Skill = Skill> extends WorkScheduler {
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number, timing?: 'buffs'): void;
  /** Cleanup runs after every same-time strike, tick, reaction, and command, so tied gameplay still sees the state. */
  scheduleExpiry(
    name: string,
    at: number,
    data?: unknown,
    options?: { readonly owner?: WorkOwner; readonly priority?: number }
  ): void;
  /** Owner lifetime is separate from cast attribution: committed projectiles can outlive their originating cast. */
  scheduleForCast(
    name: string,
    at: number,
    cast: RuntimeCast<TSkill>,
    data?: Record<string, unknown>,
    owner?: WorkOwner,
    priority?: number,
    timing?: 'buffs'
  ): void;
}
