import type { Skill } from '#gw2/platform/engine/types.js';

export type RotationActionKind =
  'weapon-skill' | 'profession-skill' | 'utility' | 'heal' | 'elite' | 'dodge' | 'weapon-swap' | 'action' | 'unknown';

export type RotationActionStatus = 'completed' | 'reduced' | 'interrupted' | 'unknown' | 'instant';

export interface ReconstructedRotationCommand {
  readonly name: string;
  readonly skillId?: string | number;
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

export interface NormalizedRotationAction {
  readonly start: number;
  readonly end: number;
  readonly eventIndex: number;
  readonly status: RotationActionStatus;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

export interface ResolvedRotationAction extends NormalizedRotationAction {
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: string | number;
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
  readonly rotation: readonly ReconstructedCommand[];
  readonly warnings: readonly string[];
}
