import type { EffectEmissionService } from '#gw2/platform/simulation/effect-emission.js';
import { createSigilRuntimeState } from '#gw2/platform/equipment/sigils/runtime.js';
import type { Gw2SigilRuntimeState } from '#gw2/platform/equipment/sigils/types.js';
import { createProcRegistry } from '#gw2/platform/combat/procs.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import type { Gw2CombatQuery, Gw2CriticalResult } from '#gw2/platform/combat/query/combat-query.js';
import { createGw2ComboRuntimeState } from '#gw2/platform/combos/events.js';
import type { Gw2ComboRuntimeState } from '#gw2/platform/combos/types.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2ConditionResolution, Gw2ResolverConditionState } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2DamageBreakdownEntry } from '#gw2/platform/resolver/hit-resolution.js';
import type {
  Gw2ConditionBreakdownEntry,
  Gw2EnvironmentConditionBreakdownEntry,
  Gw2EventQueue,
  Gw2ProcStep,
  Gw2ResolverEvent,
  Gw2ResolverHelpers,
  Gw2ResolverReactionRegistry,
  Gw2ResolverStage
} from '#gw2/platform/resolver/types.js';
import type { Gw2Config, Gw2CriticalDamageMode } from '#gw2/platform/simulation/config.js';
import { normalizeCriticalDamageMode } from '#gw2/platform/simulation/randomness.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

/**
 * Creates the mutable state for the full GW2 timeline resolver.
 * Profession state is supplied independently from common relic, sigil,
 * condition, damage, and reporting state.
 */
export function createGw2ResolverRuntimeState({
  reporting = true,
  damageDiagnostics = false,
  config,
  traits = new Set(),
  horizon,
  query,
  helpers,
  queue,
  effects,
  professionState = {},
  warnings = [],
  onFirstDamage,
  reactions
}: CreateGw2ResolverRuntimeStateOptions): Gw2ResolverRuntime {
  const criticalDamageMode = normalizeCriticalDamageMode(config.criticalDamageMode);
  const runtime: Gw2ResolverRuntime = {
    // Distribution trials always couple damage to crit outcomes, regardless of the baseline preference.
    criticalDamageMode: config.randomness?.mode === 'stochastic' ? 'rolled' : criticalDamageMode,
    reporting,
    damageDiagnostics: reporting && damageDiagnostics,
    config,
    traits,
    horizon,
    query,
    helpers,
    queue,
    effects,
    warnings,
    breakdown: new Map(),
    conditions: new Map(),
    environmentDamage: 0,
    environmentConditions: new Map(),
    conditionState: new Map(),
    resolved: [],
    procSteps: [],
    procKeys: new Set(),
    procs: createProcRegistry(() => runtime),
    boons: new Map(),
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
    relic: createRelicRuntime(config.relic),
    profession: professionState,
    sigil: createSigilRuntimeState(),
    random: createSimulationRandom(config.randomness),
    weaponStrengthRolls: new Map(),
    weaponStrengthActivationOrder: 0,

    dispatchReaction(stage, event, details) {
      return reactions?.dispatch(stage, this, event, details);
    },

    addBreakdown(
      name: string,
      damage: number,
      type: 'strikeDamage' | 'conditionDamage',
      hits = 0,
      source: Gw2ResolverEvent | null = null,
      critical: Gw2CriticalResult | null = null
    ): void {
      // Damage totals and reaction state are maintained separately from these display rows.
      if (!reporting) return;
      const sourceSkill = source?.skillName || source?.name || name;
      const parentSkill = source?.parentSkillName || '';
      const skillId = source?.skillId ?? null;
      const sourceId = source?.sourceId ?? skillId ?? sourceSkill;
      const identityId = skillId ?? sourceId;
      // Summon subtype prevents clone and phantasm entries from sharing one identity bucket.
      const actorIdentity = source?.summonKind
        ? `${source.actorType}:${source.summonKind}`
        : (source?.actorType ?? source?.source ?? '');
      const key = source ? `${String(identityId)}|${actorIdentity}|${parentSkill}|${name}` : name;
      const current: Gw2DamageBreakdownEntry = this.breakdown.get(key) || {
        name,
        sourceSkill,
        parentSkill,
        damageBreakdownName: source?.damageBreakdownName,
        icon: source?.icon || '',
        skillId,
        sourceId,
        actorType: source?.actorType,
        summonKind: source?.summonKind,
        source: source?.source,
        damage: 0,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
        critHits: 0,
        critEligibleHits: 0
      };
      if (current.skillId == null && source?.skillId != null) {
        current.skillId = source.skillId;
      }

      if (current.sourceId == null) {
        current.sourceId = sourceId;
      }

      if (!current.actorType && source?.actorType) {
        current.actorType = source.actorType;
      }

      if (!current.summonKind && source?.summonKind) {
        current.summonKind = source.summonKind;
      }

      if (!current.source && source?.source) {
        current.source = source.source;
      }

      current.damage += damage;
      current[type] += damage;
      current.hits += hits;
      // Both modes report the seeded critical outcomes used by proc reactions.
      if (type === 'strikeDamage' && critical) {
        const eligible = hits || 0;
        current.critEligibleHits = (current.critEligibleHits || 0) + eligible;
        const critShare = critical.didCrit === true ? eligible : 0;
        current.critHits = (current.critHits || 0) + critShare;
      }

      this.breakdown.set(key, current);
    },

    markDamageTime(at: number): void {
      // First positive damage starts both DPS reporting and the shared condition clock.
      if (this.firstHitTime == null) {
        this.firstHitTime = at;
        onFirstDamage?.(this);
      }

      this.lastHitTime = at;
    }
  };
  return runtime;
}

/** Owns the resolver/types.ts contracts so type dependencies follow their runtime feature boundaries. */
// Resolution consumes kernel randomness and generic records without execution dependencies.

export interface Gw2ResolverRuntime {
  readonly criticalDamageMode: Gw2CriticalDamageMode;
  readonly procs: ReturnType<typeof createProcRegistry>;
  readonly reporting: boolean;
  readonly damageDiagnostics: boolean;
  config: Gw2Config;
  traits: ReadonlySet<string | number>;
  /** Unknown until the live cursor and its occupied lanes finish. */
  horizon: number | null;
  query: Readonly<Gw2CombatQuery>;
  helpers: Gw2ResolverHelpers;
  queue: Gw2EventQueue;
  readonly effects: EffectEmissionService;
  warnings: string[];
  breakdown: Map<string, Gw2DamageBreakdownEntry>;
  conditions: Map<string, Gw2ConditionBreakdownEntry>;
  environmentDamage: number;
  environmentConditions: Map<string, Gw2EnvironmentConditionBreakdownEntry>;
  conditionState: Map<string, Gw2ResolverConditionState>;
  conditionBufferAt?: number;
  conditionBufferedAt?: number;
  resolved: Gw2ResolverEvent[];
  procSteps: Gw2ProcStep[];
  procKeys: Set<string>;
  boons: Map<string, Gw2TimedBuffApplication[]>;
  totals: { strike: number; condition: number };
  firstHitTime: number | null;
  lastHitTime: number | null;
  deathTime: number | null;
  combatStartTime?: number | null;
  combatStartPending?: boolean;
  activeWeaponSet: number;
  combo: Gw2ComboRuntimeState;
  relic: Gw2RelicRuntime;
  precastRelics?: readonly Gw2RelicRuntime[];
  profession: object;
  sigil: Gw2SigilRuntimeState;
  random: Readonly<SimulationRandom>;
  weaponStrengthRolls: Map<string, { profileId: string; value: number }>;
  weaponStrengthActivationOrder: number;
  dispatchReaction(
    stage: Gw2ResolverStage,
    event: Gw2ResolverEvent,
    details?: Record<string, unknown>
  ): Record<string, unknown> | void;
  addBreakdown(
    name: string,
    damage: number,
    type: 'strikeDamage' | 'conditionDamage',
    hits?: number,
    source?: Gw2ResolverEvent | null,
    critical?: Gw2CriticalResult | null
  ): void;
  markDamageTime(at: number): void;
}

interface CreateGw2ResolverRuntimeStateOptions {
  readonly damageDiagnostics?: boolean;
  readonly reporting?: boolean;
  readonly config: Gw2Config;
  readonly traits?: ReadonlySet<string | number>;
  readonly horizon: number | null;
  readonly query: Readonly<Gw2CombatQuery>;
  readonly helpers: Gw2ResolverHelpers;
  readonly queue: Gw2EventQueue;
  readonly effects: EffectEmissionService;
  readonly professionState?: object;
  readonly warnings?: string[];
  readonly onFirstDamage?: Gw2ConditionResolution['startDamageClock'];
  readonly reactions?: Gw2ResolverReactionRegistry;
}
