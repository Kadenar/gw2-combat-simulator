import { createGameWorkerEndpoint } from '#browser/game/worker-harness.js';
import { evaluateSkillDamage, type SkillDamageCache } from '#gw2/platform/skill-damage/evaluate.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { SkillDamageRequest } from '#gw2/platform/skill-damage/types.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';

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
      evaluation: evaluateSkillDamage(
        request,
        (rotation, config, tailMs) =>
          simulateGw2({
            profession,
            rotation,
            config,
            damageDiagnostics: true,
            observationPolicy: { kind: 'tail', durationMs: tailMs }
          }),
        cache
      )
    };
  }
});
