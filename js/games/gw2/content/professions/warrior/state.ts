import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { WarriorEndStateProjectionOptions, WarriorState } from '#gw2/content/professions/warrior/types.js';
import {
  WARRIOR_CORE_PUBLIC_END_STATE_DEFAULTS,
  WARRIOR_CORE_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/warrior/core/state.js';
import {
  BERSERKER_PUBLIC_END_STATE_DEFAULTS,
  BERSERKER_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/warrior/specializations/berserker/state.js';
import {
  BLADESWORN_PUBLIC_END_STATE_DEFAULTS,
  BLADESWORN_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/warrior/specializations/bladesworn/state.js';
import {
  PARAGON_PUBLIC_END_STATE_DEFAULTS,
  PARAGON_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/warrior/specializations/paragon/state.js';
import {
  SPELLBREAKER_PUBLIC_END_STATE_DEFAULTS,
  SPELLBREAKER_PUBLIC_END_STATE_KEYS
} from '#gw2/content/professions/warrior/specializations/spellbreaker/state.js';

/** Aggregates Core and active-specialization state at the Warrior family boundary. */
export function snapshotWarriorState(state: unknown): WarriorState {
  return snapshotProfessionState<WarriorState>(state);
}

export const WARRIOR_PUBLIC_END_STATE_KEYS: readonly (keyof WarriorState)[] = Object.freeze([
  ...WARRIOR_CORE_PUBLIC_END_STATE_KEYS,
  ...BERSERKER_PUBLIC_END_STATE_KEYS,
  ...SPELLBREAKER_PUBLIC_END_STATE_KEYS,
  ...BLADESWORN_PUBLIC_END_STATE_KEYS,
  ...PARAGON_PUBLIC_END_STATE_KEYS
]);

const INACTIVE_DEFAULTS: Readonly<Partial<WarriorState>> = Object.freeze({
  ...WARRIOR_CORE_PUBLIC_END_STATE_DEFAULTS,
  ...BERSERKER_PUBLIC_END_STATE_DEFAULTS,
  ...SPELLBREAKER_PUBLIC_END_STATE_DEFAULTS,
  ...BLADESWORN_PUBLIC_END_STATE_DEFAULTS,
  ...PARAGON_PUBLIC_END_STATE_DEFAULTS
});

/** Projects the stable public end state after the active slice has been flattened. */
export function projectWarriorEndState({ schedulerState }: WarriorEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotWarriorState(schedulerState.profession);
  return projectPublicProfessionState(state, WARRIOR_PUBLIC_END_STATE_KEYS, INACTIVE_DEFAULTS);
}
