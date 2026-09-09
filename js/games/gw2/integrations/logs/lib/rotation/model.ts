export type RotationActionKind =
  'weapon-skill' | 'profession-skill' | 'utility' | 'heal' | 'elite' | 'dodge' | 'weapon-swap' | 'action' | 'unknown';

export type RotationActionStatus = 'completed' | 'reduced' | 'interrupted' | 'unknown' | 'instant';

/** Each log adapter returns this notice once; saved rotations do not pass through log adapters. */
export const LOG_OPENER_WARNING =
  'The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.';

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

export interface ReconstructedRotationCommand {
  readonly name: string;
  readonly skillId?: string | number;
  readonly offTarget?: boolean;
  readonly offset?: number;
  readonly interruptMs?: number;
  readonly initialStateDurationMs?: number;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

export interface ReconstructedCombatStartCommand {
  readonly name: '__combat_start';
  readonly offset?: number;
}

export interface ReconstructedWaitCommand {
  readonly name: '__wait';
  readonly waitMs: number;
}

export interface ReconstructedCooldownResetCommand {
  readonly name: '__cooldown_reset';
}

export type ReconstructedCommand =
  | ReconstructedRotationCommand
  | ReconstructedCombatStartCommand
  | ReconstructedWaitCommand
  | ReconstructedCooldownResetCommand;

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
  readonly rotation: readonly ReconstructedCommand[];
  readonly warnings: readonly string[];
}
