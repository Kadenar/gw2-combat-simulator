import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';

/** Select a simulation run and its observations without declaring domain state or output schemas. */

export interface Gw2SimulationOptions {
  /** Detailed editor results can omit chart histories while retaining events, APM, and planning snapshots. */
  readonly collectChartData?: boolean;
  /** Capture formula facts during detailed execution; never persisted as build configuration. */
  readonly damageDiagnostics?: boolean;
  /** Optional profiler receives phase durations; normal simulations avoid clock reads. */
  readonly onPhase?: (phase: 'preparation' | 'execution' | 'reporting', durationMs: number) => void;
  readonly profession: Gw2ProfessionSource;
  readonly rotation: readonly unknown[];
  readonly config?: Gw2Config;
  readonly observationPolicy?: ObservationPolicy;
  /** Preserve the full rotation's explicit boundary when simulating a prefix without its marker. */
  readonly combatStartTime?: number;
}
