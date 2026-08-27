import { createSimulationRandom } from '../../../../kernel/core/simulation-random.js';
import type { SchedulerRecord, SchedulerState, SimulationRandom } from '../engine/types.js';
import { createRelicRuntime } from '../equipment/relics/runtime.js';
import { createCanonicalTargetConditionStateMap } from '../combat/state/targets.js';
import type { Gw2CombatQuery } from '../combat/query/types.js';
import type { Gw2Config } from '../simulation/config.js';
import type { Gw2RelicRuntime } from '../equipment/relics/types.js';
import type { Gw2RuntimeConditionEntry, Gw2TimedBuffApplication } from '../combat/state/types.js';

export interface MaterializerProfessionState extends SchedulerRecord {
  maximumEndurance?: number;
  endurance?: number;
  enduranceUpdatedAt?: number;
}

export interface MaterializerState extends SchedulerRecord {
  config: Gw2Config;
  traits: ReadonlySet<string | number> | null;
  query: Readonly<Gw2CombatQuery> | null;
  state: SchedulerState<SchedulerRecord> | null;
  profession: MaterializerProfessionState | null;
  activeWeaponSet: number;
  combatActive: boolean;
  combatBeganAt: number | null;
  criticalFactsRequired: boolean;
  boons: Map<string, Gw2TimedBuffApplication[]>;
  conditionState: Map<string, Gw2RuntimeConditionEntry>;
  totals: { strike: number; condition: number };
  relic: Gw2RelicRuntime;
  random: Readonly<SimulationRandom>;
  sigil: {
    readyAt: Map<string, number>;
    criticalProgress: number;
    doomPending: boolean;
    severanceUntil: number;
  };
}

export function createMaterializerState(
  config: Gw2Config,
  traits: ReadonlySet<string | number> | null,
  criticalFactsRequired: boolean
): MaterializerState {
  return {
    config,
    traits,
    query: null,
    state: null,
    profession: null,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    combatActive: false,
    combatBeganAt: null,
    criticalFactsRequired,
    boons: new Map(),
    conditionState: createCanonicalTargetConditionStateMap(),
    totals: { strike: 0, condition: 0 },
    relic: createRelicRuntime(config.relic),
    random: createSimulationRandom(config.randomness),
    sigil: {
      readyAt: new Map(),
      criticalProgress: 0,
      doomPending: false,
      severanceUntil: 0
    }
  };
}
