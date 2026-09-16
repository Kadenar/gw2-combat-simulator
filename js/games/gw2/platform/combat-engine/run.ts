/**
 * Public entry point for the TypeScript combat engine.
 *
 * Validates an encounter (or accepts one already prepared), builds a run-local
 * registry and random source, runs the reference loop, and returns a
 * structured result or an explicit failure. Prepared encounters are immutable
 * and may be reused across runs; every mutable structure is created per run.
 */
import { ConfigurationError, readEncounter } from '#gw2/platform/combat-engine/configuration.js';
import { DEFAULT_TICK_LIMIT, runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { createRegistry } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { skillStatuses } from '#gw2/platform/combat-engine/systems/audit.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import type { Encounter } from '#gw2/platform/combat-engine/configuration.js';
import type { DamageTotals } from '#gw2/platform/combat-engine/systems/audit.js';
import type {
  EngineFailure,
  EngineIdentity,
  EngineOutcome,
  EngineRequest,
  EngineResult
} from '#gw2/platform/combat-engine/types.js';

/** Engine revision recorded on every run so a result can be reproduced later. */
export const COMBAT_ENGINE_REVISION = 'phase-2-effects-first-attribute-cache';

/** The pinned upstream gw2combat commit this engine was ported from. */
export const REFERENCE_REVISION = 'cc9a0d069350516b6daba7d80d4395f9004971d5';

const preparedEncounters = new WeakSet<object>();

/** Validates and freezes an encounter once so batch callers can reuse it across runs. */
export function prepareEncounter(encounter: unknown): Encounter {
  if (encounter != null && typeof encounter === 'object' && preparedEncounters.has(encounter)) {
    return encounter as Encounter;
  }

  const prepared = readEncounter(encounter);
  preparedEncounters.add(prepared);
  return prepared;
}

function identityFor(request: EngineRequest): EngineIdentity {
  const seed = Number(request.seed ?? 1);
  return Object.freeze({
    engine: 'gw2.combat-engine' as const,
    engineRevision: COMBAT_ENGINE_REVISION,
    referenceRevision: REFERENCE_REVISION,
    contentRevision: String(request.contentRevision ?? 'unspecified'),
    mode: request.output === 'score' ? ('score' as const) : ('detailed' as const),
    seed: Number.isSafeInteger(seed) ? seed : 1,
    stepMs: Number(request.stepMs ?? 1)
  });
}

function failure(
  identity: EngineIdentity,
  code: string,
  message: string,
  details: { readonly path?: string; readonly tick?: number } = {}
): EngineFailure {
  return Object.freeze({ ok: false as const, identity, code, message, ...details });
}

function errorCode(error: unknown): string {
  const code = error != null && typeof error === 'object' ? (error as { readonly code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : 'engine.failed';
}

export function runCombatEngine(request: EngineRequest): EngineOutcome {
  const identity = identityFor(request);
  let tick: number | undefined;

  try {
    const encounter = prepareEncounter(request?.encounter);
    const tickLimit = request.tickLimit ?? DEFAULT_TICK_LIMIT;
    if (!Number.isSafeInteger(tickLimit) || tickLimit < 0) {
      return failure(identity, 'request.invalid-tick-limit', 'tickLimit must be a non-negative integer.');
    }

    if (!Number.isSafeInteger(identity.stepMs) || identity.stepMs < 1) {
      return failure(identity, 'request.invalid-step', 'stepMs must be a positive integer.');
    }

    const registry = createRegistry(
      encounter,
      createRandomSource(identity.seed),
      identity.mode === 'detailed',
      identity.stepMs
    );
    const damage: DamageTotals = { total: 0, bySourceActor: new Map() };
    try {
      setupEncounter(registry);
      const terminatedBy = runCombatLoop(registry, damage, tickLimit);
      const result: EngineResult = {
        ok: true,
        identity,
        endTick: registry.tick,
        terminatedBy,
        totalDamage: damage.total,
        dps: registry.tick > 0 ? (damage.total * 1000) / registry.tick : 0,
        damageBySourceActor: Object.fromEntries(damage.bySourceActor),
        afkTicksByActor: Object.fromEntries(registry.afkTicksByActor),
        counterValues: Object.fromEntries(
          [...registry.isCounter.entries()].map(([, counter]) => [counter.configuration.counterKey, counter.value])
        ),
        ...(registry.detailed ? { events: registry.auditEvents, skillStatus: skillStatuses(registry) } : {})
      };
      return Object.freeze(result);
    } finally {
      tick = registry.tick;
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return failure(identity, error.code, error.message, { path: error.path });
    }

    return failure(identity, errorCode(error), error instanceof Error ? error.message : String(error), { tick });
  }
}
