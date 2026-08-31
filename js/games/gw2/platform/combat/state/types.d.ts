/** Owns the combat/state/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';

export type Gw2BuffAudience = 'all' | 'summon' | 'summon-trait';

export interface Gw2TargetConfig extends SchedulerRecord {
  readonly conditions?: Readonly<Record<string, number | boolean>>;
  readonly health?: number;
  readonly armor?: number;
  readonly moving?: boolean;
  readonly confusionActivationsPerSecond?: number;
  readonly disabled?: boolean;
  readonly defianceBroken?: boolean;
}

export interface Gw2RuntimeConditionStack extends SchedulerRecord {
  readonly appliedAt?: number;
  readonly expiresAt?: number;
  readonly removedAt?: number;
  readonly weight?: number;
  readonly stacks?: number;
}

export interface Gw2RuntimeConditionEntry extends SchedulerRecord {
  readonly stacks: Gw2RuntimeConditionStack[];
}

export interface Gw2RuntimeStateLike extends SchedulerRecord {
  readonly conditionState?: Map<string, Gw2RuntimeConditionEntry>;
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
  readonly environmentDamage?: number;
}

export interface Gw2TimedBuffApplication {
  readonly at: number;
  readonly expiresAt: number;
  readonly stacks: number;
  readonly source?: string;
  readonly affectsSelf?: boolean;
  readonly affectsSummons?: boolean;
  readonly alliedPlayerCount?: number;
  readonly companionIds?: readonly string[];
  readonly recipientCount?: number;
}
