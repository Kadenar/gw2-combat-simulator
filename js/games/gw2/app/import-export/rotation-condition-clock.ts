/** Validate the condition tick offset carried by a rotation and explain its effect before it is imported. */
import type { ProfessionAppState } from '#gw2/app/types.js';
import {
  CONDITION_TICK_OFFSET_MAX_MS,
  CONDITION_TICK_OFFSET_STEP_MS,
  isConditionTickOffsetMs,
  normalizeConditionTickOffsetMs
} from '#gw2/platform/combat/condition-clock.js';

/** Absent metadata leaves the reader's own setting alone. An explicit unsupported value fails instead of snapping. */
export function readRotationConditionTickOffset(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'conditionTickOffsetMs')) return null;

  const value = (payload as { conditionTickOffsetMs: unknown }).conditionTickOffsetMs;

  if (!isConditionTickOffsetMs(value)) {
    throw new Error(
      `Condition tick offset must be between 0 and ${CONDITION_TICK_OFFSET_MAX_MS} ms in ${CONDITION_TICK_OFFSET_STEP_MS} ms steps.`
    );
  }

  return value;
}

/** Only explicit offset metadata changes the destination workspace; plain rotations retain its preference. */
export function rotationConditionTickOffsetNotices(
  offset: number | null | undefined,
  app: ProfessionAppState
): string[] {
  if (offset == null || offset === normalizeConditionTickOffsetMs(app.simulationSettings?.conditionTickOffsetMs))
    return [];

  const scope = app.workspace?.scenario ? 'this boss workspace' : 'Golem settings for every profession';
  return [
    `Condition tick offset: This file used ${offset} ms. Applying this import will update ${scope}. Rotation Undo does not revert this setting.`
  ];
}
