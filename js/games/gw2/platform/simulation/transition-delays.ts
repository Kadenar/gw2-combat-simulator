import type { SimulationEventInput, SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export const TRANSITION_DELAY_KEYS = [
  'weaponSwapMs',
  'forgeEntryMs',
  'forgeExitMs',
  'shroudEntryMs',
  'shroudExitMs'
] as const;
export type TransitionDelayKind = (typeof TRANSITION_DELAY_KEYS)[number];
export type TransitionDelays = Record<TransitionDelayKind, number>;
export const TRANSITION_LOCKOUT_EVENT = 'gw2.transition-lockout';

/** Missing or malformed preferences preserve zero-delay simulation and never introduce an infinite clock. */
export function normalizeTransitionDelays(value: unknown): TransitionDelays {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    TRANSITION_DELAY_KEYS.map((key) => {
      const delay = source[key];
      return [key, typeof delay === 'number' && Number.isFinite(delay) ? Math.max(0, delay) : 0];
    })
  ) as TransitionDelays;
}

/** Record actual bar-transition recovery separately from casts, recharge, and sigil-swap triggers. */
export function emitTransitionLockout(
  context: {
    readonly config?: Gw2Config;
    readonly action?: SimulationEvent | null;
    emit(event: SimulationEventInput): unknown;
  },
  kind: TransitionDelayKind,
  at: number,
  skill?: { readonly id: SkillId; readonly name: string }
): void {
  const duration = normalizeTransitionDelays(context.config?.transitionDelays)[kind] / 1000;
  if (!duration || context.action?.cancelled) return;
  context.emit({
    type: TRANSITION_LOCKOUT_EVENT,
    at,
    duration,
    kind,
    source: 'gw2',
    sourceId: skill?.id ?? kind,
    actorType: 'player',
    ...(skill ? { skillId: skill.id, skillName: skill.name } : {}),
    name: 'Transition delay'
  });
}
