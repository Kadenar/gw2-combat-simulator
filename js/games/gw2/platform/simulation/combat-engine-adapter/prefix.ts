/** Reads an insertion boundary from a fresh engine world, without draining delayed work or using legacy state. */
import { ConfigurationError } from '#gw2/platform/combat-engine/configuration.js';
import { COMBAT_ENGINE_REVISION, REFERENCE_REVISION, prepareEncounter } from '#gw2/platform/combat-engine/run.js';
import { DEFAULT_TICK_LIMIT, RunawayRunError, runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { createRegistry, entityName, view } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { skillStatuses } from '#gw2/platform/combat-engine/systems/audit.js';
import { findDirectSkillEntity } from '#gw2/platform/combat-engine/queries.js';
import type { EngineFailure, EngineIdentity, SkillStatus } from '#gw2/platform/combat-engine/types.js';
import type { AdaptedEngineRequest } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type { Gw2SimulationEndState } from '#gw2/platform/simulation/types.js';

export interface CombatPrefixState extends Gw2SimulationEndState {
  readonly insertionIndex: number;
  readonly bundle: string | null;
  readonly counters: Readonly<Record<string, number>>;
  readonly availability: Readonly<Record<string, SkillStatus>>;
  readonly cooldownsBySkillId: Gw2SimulationEndState['cooldowns'];
  readonly profession: { readonly counters: Readonly<Record<string, number>> };
}
export type CombatPrefixOutcome =
  | EngineFailure
  | {
      readonly ok: true;
      readonly output: 'prefix';
      readonly identity: EngineIdentity;
      readonly state: CombatPrefixState;
    };

export function runCombatPrefix(request: AdaptedEngineRequest, insertionIndex: number, seed = 1): CombatPrefixOutcome {
  const identity: EngineIdentity = {
    engine: 'gw2.combat-engine',
    engineRevision: COMBAT_ENGINE_REVISION,
    referenceRevision: REFERENCE_REVISION,
    contentRevision: request.contentRevision ?? 'unspecified',
    mode: 'detailed',
    seed,
    stepMs: 1
  };
  let tick = 0;
  try {
    // Reuse precisely the engine's setup and tick loop; the adapter only selects termination and reads the world.
    const encounter = prepareEncounter(request.encounter);
    // Only terminal state is needed; suppress report history while preserving the same execution.
    const registry = createRegistry(encounter, createRandomSource(seed), false, 1);
    const tickLimit = request.tickLimit ?? DEFAULT_TICK_LIMIT;
    if (!Number.isSafeInteger(tickLimit) || tickLimit < 0)
      return {
        ok: false,
        identity,
        code: 'request.invalid-tick-limit',
        message: 'tickLimit must be a non-negative integer.'
      };
    let terminatedBy;
    try {
      setupEncounter(registry);
      terminatedBy = runCombatLoop(registry, { total: 0, bySourceActor: new Map() }, tickLimit);
    } finally {
      tick = registry.tick;
    }

    if (terminatedBy === 'downstate')
      return {
        ok: false,
        identity,
        code: 'preview.prefix-ended-by-death',
        message: 'The encounter ended before a usable insertion state could be projected.',
        tick
      };
    const player = [...view([registry.isActor], [registry.owner]).entities()].find(
      (entity) => entityName(registry, entity) === 'player'
    );
    if (player === undefined) throw new Error('Preview encounter has no player actor.');
    const statuses = skillStatuses(registry).player;
    const availability: Record<string, SkillStatus> = {};
    const ammoBySkillId: Record<string, unknown> = {};
    const cooldownsBySkillId: Record<string, { readyAt: number; remaining: number }> = {};
    const cooldowns: Record<string, { readyAt: number; remaining: number }> = {};
    for (const [key, source] of Object.entries(request.damageSources)) {
      if (source.skillId === undefined || source.sourceIndex !== undefined) continue;
      const status = statuses[key];
      const entity = findDirectSkillEntity(registry, key, player);
      if (!status || entity === undefined) continue;
      const remaining = registry.hasAlacrity.has(player)
        ? status.remainingCooldownWithAlacrity
        : status.remainingCooldownWithoutAlacrity;
      availability[source.skillId] = status;
      cooldownsBySkillId[source.skillId] = {
        remaining: status.ammo > 0 ? 0 : remaining,
        readyAt: tick + (status.ammo > 0 ? 0 : remaining)
      };
      cooldowns[source.name] = cooldownsBySkillId[source.skillId];
      ammoBySkillId[source.skillId] = {
        charges: status.ammo,
        maximum: registry.ammo.get(entity).maxAmmo,
        remaining,
        nextChargeAt: remaining > 0 ? tick + remaining : null
      };
    }

    const build = encounter.actors.find((actor) => actor.name === 'player')!.build;
    const counterKeys = new Set(
      [build, ...build.recipes].flatMap((recipe) => recipe.counters.map((counter) => counter.counterKey))
    );
    const counters = Object.fromEntries(
      [...registry.isCounter.entries()]
        .filter(([, counter]) => counterKeys.has(counter.configuration.counterKey))
        .map(([, counter]) => [counter.configuration.counterKey, counter.value])
    );
    return {
      ok: true,
      output: 'prefix',
      identity,
      state: {
        insertionIndex,
        time: tick,
        activeWeaponSet: registry.currentWeaponSet.get(player) === 'set_2' ? 2 : 1,
        bundle: registry.bundle.tryGet(player) ?? null,
        counters,
        profession: { counters },
        availability,
        ammoBySkillId,
        ammo: {},
        cooldownsBySkillId,
        cooldowns
      }
    };
  } catch (error) {
    const sourceIndex = /adapter\.command\.(\d+):/.exec(error instanceof Error ? error.message : '')?.[1];
    const details =
      error instanceof ConfigurationError
        ? { code: error.code, path: error.path }
        : { code: error instanceof RunawayRunError ? error.code : 'preview.prefix-failed' };
    if (sourceIndex !== undefined) Object.assign(details, { path: `rotation[${sourceIndex}]` });
    return { ok: false, identity, ...details, tick, message: error instanceof Error ? error.message : String(error) };
  }
}
