import { flattenProfessionState, projectPublicProfessionState } from '../../platform/engine/profession/state.js';
import type { WarriorEndStateProjectionOptions, WarriorState } from './types.js';

/** Aggregates Core and active-specialization state at the Warrior family boundary. */
export function snapshotWarriorState(state: unknown): WarriorState {
  return structuredClone(flattenProfessionState(state)) as unknown as WarriorState;
}

export const WARRIOR_PUBLIC_END_STATE_KEYS: readonly (keyof WarriorState)[] = Object.freeze([
  'adrenaline',
  'resource',
  'maximumAdrenaline',
  'endurance',
  'maximumEndurance',
  'autoattackChains',
  'availableFlips',
  'berserkActive',
  'berserkUntil',
  'attackerInsightExpiries',
  'fullCounterActiveUntil',
  'magebaneTetherUntil',
  'magebaneTetherReadyAt',
  'flow',
  'maximumFlow',
  'flowStabilizerWindows',
  'traitPositiveFlowStartedAt',
  'traitPositiveFlowUntil',
  'gunsaberActive',
  'dragonTriggerActive',
  'dragonCharges',
  'overchargedCartridgeWindows',
  'motivation',
  'maximumMotivation',
  'activeRefrain'
]);

const INACTIVE_DEFAULTS: Readonly<Partial<WarriorState>> = Object.freeze({
  berserkActive: false,
  berserkUntil: 0,
  attackerInsightExpiries: [],
  fullCounterActiveUntil: 0,
  magebaneTetherUntil: 0,
  magebaneTetherReadyAt: 0,
  flow: 0,
  maximumFlow: 100,
  flowStabilizerWindows: [],
  traitPositiveFlowStartedAt: 0,
  traitPositiveFlowUntil: 0,
  gunsaberActive: false,
  dragonTriggerActive: false,
  dragonCharges: 0,
  overchargedCartridgeWindows: [],
  motivation: 0,
  maximumMotivation: 10,
  activeRefrain: '',
  endurance: 100,
  maximumEndurance: 100
});

/** Projects the stable public end state after the active slice has been flattened. */
export function projectWarriorEndState({ schedulerState }: WarriorEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotWarriorState(schedulerState.profession);
  return projectPublicProfessionState(state, WARRIOR_PUBLIC_END_STATE_KEYS, INACTIVE_DEFAULTS);
}
