import type { RotationCommand } from '#gw2/platform/execution/types.js';
export type RotationActionKind =
  'weapon-skill' | 'profession-skill' | 'utility' | 'heal' | 'elite' | 'dodge' | 'weapon-swap' | 'action' | 'unknown';

export type RotationActionStatus = 'completed' | 'reduced' | 'interrupted' | 'unknown' | 'instant';

/** Each log adapter returns this notice once; saved rotations do not pass through log adapters. */
export const LOG_OPENER_WARNING =
  'The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.';

export const MUSHROOM_KINGS_BLESSING_SKILL_ID = 46970;
export const MUSHROOM_KINGS_BLESSING_BUFF_ID = 34523;
export const MUSHROOM_KINGS_BLESSING_NAME = "Mushroom King's Blessing";

/** Identifies the training-area cast that log imports translate into the simulator's cooldown-reset marker. */
export function isMushroomKingsBlessing(action: {
  readonly rawSkillId: number;
  readonly rawName?: string;
  readonly name?: string;
}): boolean {
  return (
    action.rawSkillId === MUSHROOM_KINGS_BLESSING_SKILL_ID ||
    (action.rawName ?? action.name) === MUSHROOM_KINGS_BLESSING_NAME
  );
}

/** Source-clock evidence stays separate from composite inputs and simulator command timing. */
export interface RotationSourceAction {
  readonly startMs: number;
  readonly durationMs: number;
  readonly rawSkillId: number;
  readonly status: RotationActionStatus;
  readonly metadataAccurate?: boolean;
  readonly acceleration?: number;
  readonly savedDurationMs?: number;
  readonly eiRule?: string;
  readonly castOrigin?: 'skill' | 'trait' | 'gear' | 'unconditional';
}

export interface RotationPlayerIdentity {
  readonly character: string;
  readonly account: string;
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly recordedActionCount: number;
}

export interface RotationActionSummary {
  readonly timestampMs: number;
  readonly endTimestampMs: number;
  readonly durationMs: number;
  readonly expectedDurationMs: number | null;
  readonly rawSkillId: number;
  readonly skillId: string | number;
  readonly name: string;
  readonly kind: RotationActionKind;
  readonly status: RotationActionStatus;
  readonly supportedByCatalog: boolean;
}

export interface RotationReconstructionBase<
  Player extends RotationPlayerIdentity,
  Action extends RotationActionSummary
> {
  readonly parserId: string;
  readonly player: Player;
  readonly timelineOriginMs: number;
  readonly combatStartTimestampMs: number | null;
  readonly actions: readonly Action[];
  readonly sourceActions?: readonly RotationSourceAction[];
  readonly rotation: readonly RotationCommand[];
  readonly warnings: readonly string[];
}
