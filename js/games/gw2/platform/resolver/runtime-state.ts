/** Maintains authoritative combat state and narrow optional reporting observers. */
import type { Gw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import type { Gw2CriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import { normalizeCriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import { createCombatEngagement, type CombatEngagementQueries } from '#gw2/platform/combat/engagement.js';
import type { LiveEffects } from '#gw2/platform/combat/live-effects.js';
import { createProcRegistry, type ProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import type { Gw2ComboController } from '#gw2/platform/combos/resolution.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import { createSigilRuntime, type SigilRuntime } from '#gw2/platform/equipment/sigils/runtime.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ConditionResolution, Gw2ResolverConditionState } from '#gw2/platform/resolver/condition-resolution.js';
import { createMechanicCombatServices, type MechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import {
  createResolvedPacketHistory,
  type ResolvedPacketOutput,
  type ResolvedPacketWriter
} from '#gw2/platform/resolver/resolved-packet-history.js';
import type { Gw2EventQueue, Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';
import type {
  createBoonGenerationCollector,
  createBoonGenerationReport
} from '#gw2/platform/results/boon-generation.js';
import type { DamageReportObserver } from '#gw2/platform/results/damage-report.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import type { EffectReportObserver } from '#gw2/platform/results/effect-report.js';
import { createHealthCheckpointRecorder } from '#gw2/platform/results/health-checkpoints.js';
import type { ProcRollObserver } from '#gw2/platform/results/proc-rate-observations.js';
import type { ProcStepObserver } from '#gw2/platform/results/proc-steps.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

/**
 * Creates the mutable state for the full GW2 timeline resolver.
 * Profession state is supplied independently from common relic, sigil,
 * condition, damage, and reporting state.
 */
export function createGw2ResolverRuntimeState({
  engagement = createCombatEngagement().query,
  output = 'detailed',
  ownsEffect,
  effectRecorder = null,
  boonGeneration = null,
  boonReport = null,
  procRecorder = null,
  damageRecorder = null,
  damageDiagnostics = false,
  config,
  traits = new Set(),
  horizon,
  query,
  helpers,
  queue,
  effects,
  professionState = {},
  conditions,
  liveEffects,
  combo,
  procRollRecorder = null,
  random = createSimulationRandom(config.randomness)
}: CreateGw2ResolverRuntimeStateOptions): Gw2ResolverRuntime {
  const criticalDamageMode = normalizeCriticalDamageMode(config.criticalDamageMode);

  const packetHistory = createResolvedPacketHistory(output, ownsEffect);

  const totals = { strike: 0, condition: 0 };
  let firstHitTime: number | null = null;
  let lastHitTime: number | null = null;
  const runtime: Gw2ResolverRuntime = {
    get combat() {
      return combat;
    },
    // Distribution trials always couple damage to crit outcomes, regardless of the baseline preference.
    criticalDamageMode: config.randomness?.mode === 'stochastic' ? 'rolled' : criticalDamageMode,
    engagement,
    output,
    // Damage previews retain resolved packets without constructing chart histories.
    effectRecorder,
    boonGeneration,
    boonReport,
    // Timeline proc rows are an optional observer; resolution only announces executed procs.
    procRecorder,
    damageRecorder,
    damageDiagnostics: output !== 'score' && damageDiagnostics,
    config,
    traits,
    horizon,
    query,
    helpers,
    queue,
    effects,
    // Each resolution pass collects its own warnings without sharing mutable state with another run.
    warnings: [],
    environmentDamage: 0,
    healthCheckpointRecorder: createHealthCheckpointRecorder(config),
    conditionState: conditions.state,
    resolved: packetHistory.events,
    resolvedPackets: packetHistory.writer,
    procs: createProcRegistry(() => runtime),
    liveEffects: Object.freeze({ queries: liveEffects.queries }),
    totals,
    get firstHitTime() {
      return firstHitTime;
    },
    get lastHitTime() {
      return lastHitTime;
    },
    deathTime: null,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    combo: Object.freeze({ activeFields: combo.activeFields, fieldFor: combo.fieldFor }),
    // Equipment state belongs to this resolution pass, including repeated runs with the same configuration.
    relic: createRelicRuntime(config.relic, config.precastRelics),
    profession: professionState,
    sigil: createSigilRuntime(),
    procRollRecorder,
    // Every scheduler and resolver roll passes through the observer when Analysis requests proc rates.
    random: procRollRecorder ? procRollRecorder.observe(random) : random,
    weaponStrengthRolls: new Map(),
    weaponStrengthActivationOrder: 0,

    /** Count only damage the encounter accepts, then expose the updated totals to the clock and health checkpoints. */
    settlePlayerDamage(event, amount, encounterTargetKey) {
      const { at } = event;
      const accepted = runtime.encounter?.damage(amount, 'player', at, encounterTargetKey) ?? amount;
      const isConditionPayout = event.type === 'condition_tick';
      totals[isConditionPayout || event.damageKind === 'condition' ? 'condition' : 'strike'] += accepted;

      if (!(accepted > 0)) return accepted;

      if (firstHitTime == null) {
        firstHitTime = at;
        // Direct hits anchor the clock even when they count toward condition damage.
        conditions.startDamageClock(runtime, isConditionPayout ? 'condition' : 'strike');
      }

      lastHitTime = at;
      runtime.healthCheckpointRecorder?.observe(at, totals.strike + totals.condition, runtime.environmentDamage);
      return accepted;
    }
  };
  const combat = createMechanicCombatServices(runtime, conditions, { liveEffects, combo });
  return runtime;
}

/** Mutable per-run resolver state: combat stores, reporting collections, and the services resolution handlers share. */
export interface Gw2ResolverRuntime {
  encounter?: import('#gw2/platform/combat/state/encounter.js').EncounterController;
  readonly combat: MechanicCombatServices;
  readonly boonGeneration: ReturnType<typeof createBoonGenerationCollector> | null;
  readonly boonReport: ReturnType<typeof createBoonGenerationReport> | null;
  readonly effectRecorder: EffectReportObserver | null;
  readonly procRecorder: ProcStepObserver | null;
  readonly damageRecorder: DamageReportObserver | null;
  readonly criticalDamageMode: Gw2CriticalDamageMode;
  readonly procs: ProcRegistry;
  readonly output: ResolvedPacketOutput;
  readonly damageDiagnostics: boolean;
  config: Gw2Config;
  traits: ReadonlySet<string | number>;
  /** Unknown until the live cursor and its occupied lanes finish. */
  horizon: number | null;
  query: Readonly<Gw2CombatQuery>;
  helpers: Gw2ResolverHelpers;
  queue: Gw2EventQueue;
  readonly effects: EffectEmissionService;
  warnings: Gw2SimulationDiagnostic[];
  environmentDamage: number;
  readonly healthCheckpointRecorder: ReturnType<typeof createHealthCheckpointRecorder>;
  readonly conditionState: ReadonlyMap<string, Gw2ResolverConditionState>;
  readonly resolved: readonly Gw2ResolverEvent[];
  readonly resolvedPackets: ResolvedPacketWriter;
  readonly liveEffects: Pick<LiveEffects, 'queries'>;
  readonly totals: { readonly strike: number; readonly condition: number };
  readonly firstHitTime: number | null;
  readonly lastHitTime: number | null;
  deathTime: number | null;
  readonly engagement: CombatEngagementQueries;
  activeWeaponSet: number;
  readonly combo: Pick<Gw2ComboController, 'activeFields' | 'fieldFor'>;
  relic: Gw2RelicRuntime;
  profession: object;
  readonly sigil: Readonly<SigilRuntime>;
  readonly procRollRecorder: ProcRollObserver | null;
  random: Readonly<SimulationRandom>;
  weaponStrengthRolls: Map<string, { profileId: string; value: number }>;
  weaponStrengthActivationOrder: number;
  settlePlayerDamage(event: Gw2ResolverEvent, amount: number, encounterTargetKey?: string): number;
}

interface CreateGw2ResolverRuntimeStateOptions {
  /** Composition retains commands while this state publishes only query views. */
  readonly liveEffects: LiveEffects;
  readonly combo: Gw2ComboController;
  readonly engagement?: CombatEngagementQueries;
  readonly boonGeneration?: ReturnType<typeof createBoonGenerationCollector> | null;
  readonly boonReport?: Gw2ResolverRuntime['boonReport'];
  readonly effectRecorder?: EffectReportObserver | null;
  readonly procRecorder?: ProcStepObserver | null;
  readonly procRollRecorder?: ProcRollObserver | null;
  readonly damageRecorder?: DamageReportObserver | null;
  readonly damageDiagnostics?: boolean;
  readonly output?: Gw2ResolverRuntime['output'];
  /** Damage measurements name the resolved packets they return; other outputs ignore ownership. */
  readonly ownsEffect?: (event: Gw2ResolverEvent) => boolean;
  readonly config: Gw2Config;
  readonly traits?: ReadonlySet<string | number>;
  readonly horizon: number | null;
  readonly query: Readonly<Gw2CombatQuery>;
  readonly helpers: Gw2ResolverHelpers;
  readonly queue: Gw2EventQueue;
  readonly effects: EffectEmissionService;
  readonly professionState?: object;
  readonly conditions: Gw2ConditionResolution;
  /** Isolated executions may supply their own roll policy; combat always seeds from its configured randomness. */
  readonly random?: Readonly<SimulationRandom>;
}
