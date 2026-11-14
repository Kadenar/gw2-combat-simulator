/** Maintains authoritative combat state and narrow optional reporting observers. */
import type { Gw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { Gw2CriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import { normalizeCriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import { createCombatEngagement, type CombatEngagementQueries } from '#gw2/platform/combat/engagement.js';
import { createProcRegistry, type ProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import type { CompanionEffects } from '#gw2/platform/combat/state/companion.js';
import { createGw2ComboRuntimeState } from '#gw2/platform/combos/resolution.js';
import type { Gw2ComboRuntimeState } from '#gw2/platform/combos/types.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import { createSigilRuntimeState } from '#gw2/platform/equipment/sigils/runtime.js';
import type { Gw2SigilRuntimeState } from '#gw2/platform/equipment/sigils/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ConditionResolution, Gw2ResolverConditionState } from '#gw2/platform/resolver/condition-resolution.js';
import { createMechanicCombatServices, type MechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import type { Gw2EventQueue, Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';
import type { createBoonGenerationCollector } from '#gw2/platform/results/boon-generation.js';
import type { DamageReportObserver } from '#gw2/platform/results/damage-report.js';
import type { Gw2SimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import type { EffectReportObserver } from '#gw2/platform/results/effect-report.js';
import { createHealthCheckpointRecorder } from '#gw2/platform/results/health-checkpoints.js';
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
  random = createSimulationRandom(config.randomness)
}: CreateGw2ResolverRuntimeStateOptions): Gw2ResolverRuntime {
  const criticalDamageMode = normalizeCriticalDamageMode(config.criticalDamageMode);

  if (output === 'damage' && !ownsEffect) throw new TypeError('Damage measurements require an effect owner.');

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
    resolved: [],
    procs: createProcRegistry(() => runtime),
    boons: new Map(),
    buffs: new Map(),
    retiredCompanions: new Map(),
    companions: new Map(),
    totals: {
      strike: 0,
      condition: 0
    },
    firstHitTime: null,
    lastHitTime: null,
    deathTime: null,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    combo: createGw2ComboRuntimeState(),
    // Equipment state belongs to this resolution pass, including repeated runs with the same configuration.
    relic: createRelicRuntime(config.relic, config.precastRelics),
    profession: professionState,
    sigil: createSigilRuntimeState(),
    random,
    weaponStrengthRolls: new Map(),
    weaponStrengthActivationOrder: 0,

    // Detailed retains all resolved rows, observations retains damage and conditions, damage retains owned packets,
    // and score retains none. Gameplay history is independent of these reporting collections.
    retainsResolved(event: Gw2ResolverEvent): boolean {
      return (
        output === 'detailed' ||
        (output === 'observations' && (event.type === 'damage' || event.type === 'condition')) ||
        (output === 'damage' && ownsEffect!(event))
      );
    },

    markDamageTime(at: number): void {
      // First positive damage starts both DPS reporting and the shared condition clock.
      if (this.firstHitTime == null) {
        this.firstHitTime = at;
        conditions.startDamageClock(this);
      }

      this.lastHitTime = at;
      this.healthCheckpointRecorder?.observe(at, this.totals.strike + this.totals.condition, this.environmentDamage);
    }
  };
  const combat = createMechanicCombatServices(runtime, conditions);
  return runtime;
}

/** Mutable per-run resolver state: combat stores, reporting collections, and the services resolution handlers share. */
export interface Gw2ResolverRuntime {
  encounter?: import('#gw2/platform/combat/state/encounter.js').EncounterController;
  readonly combat: MechanicCombatServices;
  readonly boonGeneration: ReturnType<typeof createBoonGenerationCollector> | null;
  readonly effectRecorder: EffectReportObserver | null;
  readonly procRecorder: ProcStepObserver | null;
  readonly damageRecorder: DamageReportObserver | null;
  readonly criticalDamageMode: Gw2CriticalDamageMode;
  readonly procs: ProcRegistry;
  readonly output: 'detailed' | 'score' | 'damage' | 'observations';
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
  resolved: Gw2ResolverEvent[];
  boons: Map<string, Gw2TimedBuffApplication[]>;
  /** Retirement ends a companion's live effects while retaining pre-removal history. */
  retiredCompanions: Map<string, number>;
  companions: Map<string, CompanionEffects>;
  buffs: Map<string, Gw2TimedBuffApplication[]>;
  totals: { strike: number; condition: number };
  firstHitTime: number | null;
  lastHitTime: number | null;
  deathTime: number | null;
  readonly engagement: CombatEngagementQueries;
  activeWeaponSet: number;
  combo: Gw2ComboRuntimeState;
  relic: Gw2RelicRuntime;
  profession: object;
  sigil: Gw2SigilRuntimeState;
  random: Readonly<SimulationRandom>;
  weaponStrengthRolls: Map<string, { profileId: string; value: number }>;
  weaponStrengthActivationOrder: number;
  retainsResolved(event: Gw2ResolverEvent): boolean;
  markDamageTime(at: number): void;
}

interface CreateGw2ResolverRuntimeStateOptions {
  readonly engagement?: CombatEngagementQueries;
  readonly boonGeneration?: ReturnType<typeof createBoonGenerationCollector> | null;
  readonly effectRecorder?: EffectReportObserver | null;
  readonly procRecorder?: ProcStepObserver | null;
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
