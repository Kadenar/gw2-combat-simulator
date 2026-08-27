import { professionCoreState, projectPublicProfessionState } from '../../platform/engine/profession/state.js';
import { snapshotThiefState, THIEF_CORE_PUBLIC_END_STATE_KEYS } from './core/state.js';
export { snapshotThiefState } from './core/state.js';
import {
  ANTIQUARY_INACTIVE_STATE_DEFAULTS,
  ANTIQUARY_PUBLIC_END_STATE_KEYS
} from './specializations/antiquary/state.js';
import {
  DAREDEVIL_INACTIVE_STATE_DEFAULTS,
  DAREDEVIL_PUBLIC_END_STATE_KEYS
} from './specializations/daredevil/state.js';
import { DEADEYE_INACTIVE_STATE_DEFAULTS, DEADEYE_PUBLIC_END_STATE_KEYS } from './specializations/deadeye/state.js';
import { SPECTER_INACTIVE_STATE_DEFAULTS, SPECTER_PUBLIC_END_STATE_KEYS } from './specializations/specter/state.js';
import type { ThiefEndStateProjectionOptions, ThiefResolverContext, ThiefResolverEvent, ThiefState } from './types.js';

// The family projector composes each independently owned state slice into the stable public end-state contract.
export const THIEF_PUBLIC_END_STATE_KEYS: readonly (keyof ThiefState)[] = Object.freeze([
  ...THIEF_CORE_PUBLIC_END_STATE_KEYS,
  ...DAREDEVIL_PUBLIC_END_STATE_KEYS,
  ...DEADEYE_PUBLIC_END_STATE_KEYS,
  ...SPECTER_PUBLIC_END_STATE_KEYS,
  ...ANTIQUARY_PUBLIC_END_STATE_KEYS
]);

const INACTIVE_STATE_DEFAULTS: Readonly<Partial<ThiefState>> = Object.freeze({
  ...DAREDEVIL_INACTIVE_STATE_DEFAULTS,
  ...DEADEYE_INACTIVE_STATE_DEFAULTS,
  ...SPECTER_INACTIVE_STATE_DEFAULTS,
  ...ANTIQUARY_INACTIVE_STATE_DEFAULTS
});

export function projectThiefEndState({ schedulerState }: ThiefEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotThiefState(schedulerState.profession) as unknown as ThiefState;
  return projectPublicProfessionState(state, THIEF_PUBLIC_END_STATE_KEYS, INACTIVE_STATE_DEFAULTS);
}

// Resolver snapshots are routed back to whichever runtime slice declares each field, preserving scheduler ownership.
export function handleThiefState(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  const incoming = structuredClone(event.state || {}) as Record<string, unknown>;
  const core = professionCoreState(context) as unknown as Record<string, unknown>;
  const specialization = context.profession.specialization.state as unknown as Record<string, unknown>;
  const ownerFor = (key: string): Record<string, unknown> =>
    Object.hasOwn(specialization, key) ? specialization : core;
  const preserved: Record<string, unknown> = {
    traitProcProgress: core.traitProcProgress || {},
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  for (const generationField of Object.keys(incoming).filter((key) => key.endsWith('Generation'))) {
    const prefix = generationField.slice(0, -'Generation'.length);
    const chargesField = `${prefix}Charges`;
    const expiresAtField = `${prefix}ExpiresAt`;
    const owner = ownerFor(generationField);
    const incomingGeneration = Number(incoming[generationField] || 0);
    const currentGeneration = Number(owner[generationField] || 0);
    if (generationField === 'spiderVenomGeneration' && incomingGeneration < currentGeneration) {
      preserved[generationField] = owner[generationField] || 0;
      if (Object.hasOwn(owner, chargesField)) preserved[chargesField] = owner[chargesField] || 0;
      if (Object.hasOwn(owner, expiresAtField)) preserved[expiresAtField] = owner[expiresAtField] || 0;
      continue;
    }

    if (
      incomingGeneration === currentGeneration &&
      Number(incoming[expiresAtField] || 0) > event.at &&
      Object.hasOwn(owner, chargesField)
    ) {
      preserved[chargesField] = owner[chargesField] || 0;
    }
  }

  for (const [key, value] of Object.entries(incoming)) ownerFor(key)[key] = value;
  for (const [key, value] of Object.entries(preserved)) ownerFor(key)[key] = value;
}
