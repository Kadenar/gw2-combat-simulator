import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RotationCommand } from '#gw2/platform/execution/rotation.js';

export interface RotationActionOptions {
  readonly skillId?: SkillId | null;
  readonly offTarget?: boolean | null;
  readonly impactDelayMs?: number | null;
  readonly concurrentOffsetMs?: number | null;
  readonly interruptAfterMs?: number | null;
  readonly releaseAtCharges?: number | null;
  readonly releaseDelayMs?: number | null;
  readonly doubleEdgeOutcome?: 'success' | 'backfire' | null;
  readonly durationMs?: number | null;
}

/** Carries a timeline index or palette name so drops can resolve the dragged entry. */
export interface ProfessionRotationDragState {
  readonly source?: string;
  readonly index?: number;
  readonly name?: string;
  readonly skillId?: SkillId;
}

/** History snapshots belong to the editable rotation and never cross build tabs. */
export interface RotationHistory {
  undo: RotationCommand[][];
  redo: RotationCommand[][];
  current: RotationCommand[];
}

export interface RotationEditingSession {
  rotationInsertionIndex?: number | null;
  _rotationHistory?: RotationHistory;
}

export interface RotationEditingState extends RotationEditingSession {
  dragState: ProfessionRotationDragState | null;
}

/** New tabs start at the rotation tail with history created from their first recorded edit. */
export function emptyRotationEditingSession(): RotationEditingSession {
  return { rotationInsertionIndex: null, _rotationHistory: undefined };
}
