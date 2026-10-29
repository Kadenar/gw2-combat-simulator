/** Validate the timing settings carried by a rotation and explain their effect before it is imported. */
import type { ProfessionAppState } from '#gw2/app/types.js';
import {
  normalizeTransitionDelays,
  TRANSITION_DELAY_KEYS,
  type TransitionDelays
} from '#gw2/platform/execution/transition-lockouts.js';

const DELAY_LABELS = {
  weaponSwapMs: 'weapon swap',
  forgeEntryMs: 'forge entry',
  forgeExitMs: 'forge exit',
  shroudEntryMs: 'shroud entry',
  shroudExitMs: 'shroud exit'
};

/** Absent metadata leaves workspace settings alone; explicit malformed values must not reset them. */
export function readRotationTransitionDelays(payload: unknown): TransitionDelays | null {
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'transitionDelays')) return null;

  const delays = (payload as { transitionDelays: unknown }).transitionDelays;

  if (
    !delays ||
    typeof delays !== 'object' ||
    Array.isArray(delays) ||
    TRANSITION_DELAY_KEYS.some((key) => {
      const value = (delays as Record<string, unknown>)[key];
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    })
  )
    throw new Error('Rotation transition delays must include every delay as a finite, non-negative number.');

  return normalizeTransitionDelays(delays);
}

/** Only announce actual changes, with the persistence scope of the destination workspace. */
export function rotationTransitionDelayNotices(
  delays: TransitionDelays | null | undefined,
  app: ProfessionAppState
): string[] {
  if (!delays) return [];

  const current = normalizeTransitionDelays(app.simulationSettings?.transitionDelays);

  if (TRANSITION_DELAY_KEYS.every((key) => current[key] === delays[key])) return [];

  const values = TRANSITION_DELAY_KEYS.map((key) => `${DELAY_LABELS[key]} ${delays[key]} ms`).join(', ');
  const scope = app.workspace?.scenario ? 'this boss workspace' : 'Golem settings for every profession';
  return [
    `Transition delays: This file used ${values}. Applying this import will update ${scope}. Rotation Undo does not revert these settings.`
  ];
}
