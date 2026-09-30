import type { CastCommand, WaitCommand, RotationCommand } from '#gw2/platform/execution/types.js';
import type { Gw2SimulationPlanningState, Gw2SimulationScore } from '#gw2/platform/simulation/types.js';

export type CombatAction = CastCommand | WaitCommand;

/** Opaque, in-memory checkpoint: resuming always allocates an isolated runtime, including hidden mechanic facts. */
export interface CombatSnapshot {
  resume(): CombatSession;
}

/** Decisions see current observations and legal choices, never pending packets or random stream positions. */
export interface CombatSession {
  readonly time: number;
  readonly done: boolean;
  observe(): Gw2SimulationPlanningState & { damage: number; done: boolean };
  actions(): CombatAction[];
  apply(action: CombatAction): void;
  snapshot(): CombatSnapshot;
  clone(): CombatSession;
  rotation(): RotationCommand[];
  score(): Gw2SimulationScore;
}
