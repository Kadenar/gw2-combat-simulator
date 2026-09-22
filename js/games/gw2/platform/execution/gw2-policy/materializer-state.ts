import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import type { SchedulerState } from '#gw2/platform/execution/types.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { createCanonicalTargetConditionStateMap } from '#gw2/platform/combat/state/targets.js';
import type { Gw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2RuntimeConditionEntry } from '#gw2/platform/combat/state/targets.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';

export interface MaterializerProfessionState {
  /** Shared resource grants mutate the live core slice; professions may omit unsupported resources. */
  core?: {
    maximumEndurance?: number;
    endurance?: number;
    enduranceUpdatedAt?: number;
  };
}

export interface MaterializerState {
  config: Gw2Config;
  traits: ReadonlySet<string | number> | null;
  query: Readonly<Gw2CombatQuery> | null;
  state: SchedulerState | null;
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
