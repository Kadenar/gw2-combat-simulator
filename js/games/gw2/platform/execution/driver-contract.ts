import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { CastCommand } from '#gw2/platform/execution/rotation.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Drivers select work; the shared runtime retains the clock, reservations, and event ordering. */
export interface RuntimeDriverContext<T extends object> {
  readonly runtime: Gw2Runtime<T>;
  readonly evaluateReadiness: (skill: Skill, command: CastCommand) => AvailabilityResult;
  readonly resetCooldowns: () => void;
  readonly advanceFrontier: (reason: string) => void;
  readonly acceptCast: (skill: Skill, command: CastCommand) => void;
  readonly reject: (reason: string) => void;
}

export interface RuntimeDriver<T extends object> {
  readonly cursor: RotationCursor;
  /** Return handled after consuming work, otherwise the next command boundary or Infinity. */
  advance(context: RuntimeDriverContext<T>): number | 'handled';
}
