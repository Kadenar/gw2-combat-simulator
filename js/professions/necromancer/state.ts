import { flattenProfessionState } from '../../platform/engine/profession/state.js';
import { syncNecromancerResources } from './core/state.js';
import { syncHarbingerState } from './specializations/harbinger/state.js';
import type { NecromancerEndStateProjectionOptions, NecromancerState } from './types.js';

/** Builds the stable flattened state boundary shared by scheduler snapshots and result projection. */
export function snapshotNecromancerState(state: unknown): NecromancerState {
  const flattened = flattenProfessionState(state) as unknown as NecromancerState;
  syncNecromancerResources(flattened);
  if (Object.hasOwn(flattened, 'blightExpiries')) syncHarbingerState(flattened);
  return structuredClone(flattened) as NecromancerState;
}

export const NECROMANCER_PUBLIC_END_STATE_KEYS: readonly (keyof NecromancerState)[] = Object.freeze([
  'lifeForce',
  'resource',
  'maximumLifeForce',
  'maximumHealth',
  'lifeForcePoolCapacity',
  'activeShroud',
  'shroudEnteredAt',
  'blight',
  'blightExpiries',
  'cascadingCorruptionStacks',
  'soulShards',
  'soulShardExpiries',
  'carapaceExpiries',
  'shades',
  'activeMinions',
  'activeSpirits',
  'availableFlips',
  'autoattackChains',
  'selfConditions',
  'lichEndsAt',
  'soulTwistingAvailable',
  'meltdownUntil',
  'dreadUntil'
]);

const NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<NecromancerState>> = Object.freeze({
  blight: 0,
  blightExpiries: [],
  cascadingCorruptionStacks: 0,
  shades: [],
  activeSpirits: {},
  soulTwistingAvailable: false,
  meltdownUntil: 0
});

/** Projects only the public cross-phase state while folding resolver-owned life-force gains into the result. */
export function projectNecromancerEndState({
  schedulerState,
  resolverState
}: NecromancerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotNecromancerState(schedulerState.profession);
  const projected = Object.fromEntries(
    NECROMANCER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key] ?? NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS[key])
    ])
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
