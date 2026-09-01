import {
  flattenProfessionState,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import type {
  ProfessionStateSnapshotEmissionContext,
  StateSnapshotEmissionOptions
} from '#gw2/platform/engine/events/state-snapshots.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import {
  NECROMANCER_CORE_PUBLIC_END_STATE_KEYS,
  syncNecromancerResources
} from '#gw2/content/professions/necromancer/core/state.js';
import {
  HARBINGER_PUBLIC_END_STATE_DEFAULTS,
  HARBINGER_PUBLIC_END_STATE_KEYS,
  syncHarbingerState
} from '#gw2/content/professions/necromancer/specializations/harbinger/state.js';
import {
  RITUALIST_PUBLIC_END_STATE_DEFAULTS,
  RITUALIST_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/necromancer/specializations/ritualist/state.js';
import {
  SCOURGE_PUBLIC_END_STATE_DEFAULTS,
  SCOURGE_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/necromancer/specializations/scourge/state.js';
import type {
  NecromancerEndStateProjectionOptions,
  NecromancerState
} from '#gw2/content/professions/necromancer/types.js';

/** Builds the stable flattened state boundary shared by scheduler snapshots and result projection. */
export function snapshotNecromancerState(state: unknown): NecromancerState {
  const flattened = snapshotProfessionState<NecromancerState>(state);
  syncNecromancerResources(flattened);
  if (Object.hasOwn(flattened, 'blightExpiries')) syncHarbingerState(flattened);
  return flattened;
}

/** Emits a synchronized Necromancer resource snapshot with shared deduplication. */
export function emitNecromancerStateSnapshot(
  context: ProfessionStateSnapshotEmissionContext,
  at: number,
  reason: string,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null {
  return emitStateSnapshot(
    context,
    'necromancer',
    at,
    reason,
    snapshotNecromancerState(context.state.profession),
    options
  );
}

export const NECROMANCER_PUBLIC_END_STATE_KEYS: readonly (keyof NecromancerState)[] = Object.freeze([
  ...NECROMANCER_CORE_PUBLIC_END_STATE_KEYS,
  ...SCOURGE_PUBLIC_END_STATE_KEYS,
  ...HARBINGER_PUBLIC_END_STATE_KEYS,
  ...RITUALIST_PUBLIC_END_STATE_KEYS
]);

const NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<NecromancerState>> = Object.freeze({
  ...SCOURGE_PUBLIC_END_STATE_DEFAULTS,
  ...HARBINGER_PUBLIC_END_STATE_DEFAULTS,
  ...RITUALIST_PUBLIC_END_STATE_DEFAULTS
});

/** Projects only the public cross-phase state while folding resolver-owned life-force gains into the result. */
export function projectNecromancerEndState({
  schedulerState,
  resolverState
}: NecromancerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotNecromancerState(schedulerState.profession);
  const projected = projectPublicProfessionState(
    state,
    NECROMANCER_PUBLIC_END_STATE_KEYS,
    NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS
  ) as Record<string, unknown> & {
    lifeForce: number;
    maximumLifeForce: number;
    resource: number;
  };
  const resolver = flattenProfessionState(resolverState || {});
  const resolverLifeForce = Math.max(0, Number(resolver.spitefulFortitudeLifeForce || 0));
  projected.lifeForce = Math.min(projected.maximumLifeForce, projected.lifeForce + resolverLifeForce);
  projected.resource = projected.lifeForce;
  return projected;
}
