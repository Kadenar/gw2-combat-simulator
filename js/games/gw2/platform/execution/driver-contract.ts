import type { CastCommand } from '#gw2/platform/builds/rotation.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Drivers select work; the shared runtime retains the clock, reservations, and event ordering. */
export interface RuntimeDriverContext<T extends object> {
  readonly runtime: Gw2Runtime<T>;
  readonly evaluateReadiness: (skill: Skill, command: CastCommand) => AvailabilityResult;
  readonly resetCooldowns: () => void;
  readonly advanceFrontier: (reason: string) => void;
  readonly acceptCast: (skill: Skill, command: CastCommand) => void;
  /** Admit a ready grant before the queued strike, after earlier lifecycle work has dispatched. */
  readonly acceptBuffCast: (skill: Skill, command: CastCommand) => void;
  readonly reject: (reason: string) => void;
}

export interface RuntimeDriver<T extends object> {
  readonly cursor: RotationCursor;
  /** Return handled after consuming work, otherwise the next command boundary or Infinity. */
  advance(context: RuntimeDriverContext<T>): number | 'handled';
  /** Only grant-only concurrent commands may overtake a tied strike. */
  advanceBuff(context: RuntimeDriverContext<T>): boolean;
}
