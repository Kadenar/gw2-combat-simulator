/**
 * Constructs the profession-neutral mutable state the scheduler owns during a
 * run: cooldowns, ammo, lockouts, skill-use counts, active weapon set, and
 * pending events. Profession-specific resources are nested under
 * `state.profession` via the profession contract.
 */
import type { SchedulerRecord, SchedulerState } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';

interface SchedulerStateOptions<TProfessionState extends object> {
  readonly profession?: {
    createProfessionState(config: Readonly<SchedulerRecord>): TProfessionState;
  };
  readonly config?: Readonly<SchedulerRecord>;
  readonly startingTime?: number;
  readonly activeWeaponSet?: number;
}

/**
 * Creates the profession-neutral mutable state owned by the scheduler.
 * Profession-specific resources are nested under `state.profession`.
 *
 */
export function createSchedulerState<TProfessionState extends object = SchedulerRecord>({
  profession,
  config = {},
  startingTime = 0,
  activeWeaponSet = 1
}: SchedulerStateOptions<TProfessionState> = {}): SchedulerState<TProfessionState> {
  if (!profession || typeof profession.createProfessionState !== 'function') {
    throw new TypeError('Scheduler state requires a profession contract.');
  }

  return {
    time: Number(startingTime || 0),
    cooldowns: new Map(),
    ammo: new Map(),
    lockouts: new Map(),
    activeWeaponSet: Math.max(1, Number(activeWeaponSet || 1)),
    skillUses: new Map(),
    pendingEvents: [] as SimulationEvent[],
    profession: profession.createProfessionState(config)
  };
}
