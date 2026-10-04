import type { GameContentAddress } from '#browser/game/contracts.js';
import { createGameWorkerEndpoint } from '#browser/game/worker-harness.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import { evaluateSkillDamage, type SkillDamageCache } from '#gw2/platform/skill-damage/measure-occurrences.js';
import type { SkillDamageRequest } from '#gw2/platform/skill-damage/types.js';

/** The single request message this worker accepts; the runner owns coalescing, cancellation, and stale responses. */
interface SkillDamageWorkerMessage {
  readonly requestId: number;
  readonly request: SkillDamageRequest & GameContentAddress;
}

// Loaded profession identity includes the content snapshot; measurements cannot cross content versions.
const caches = new WeakMap<Gw2ProfessionSource, SkillDamageCache>();

/** Measures every probe through the engine with damage diagnostics, without loading browser adapters. */
createGameWorkerEndpoint<Gw2ProfessionSource, SkillDamageWorkerMessage>({
  calculate(profession, { request }) {
    const cache = caches.get(profession) ?? new Map();
    caches.set(profession, cache);
    return {
      evaluation: evaluateSkillDamage(request, profession, cache)
    };
  }
});
