import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { createProcRegistry, type ProcRegistryContext } from '#gw2/platform/combat/procs/registry.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createSigilRuntime } from '#gw2/platform/equipment/sigils/runtime.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

// A proc owner needs no resolver stores, event queues, or reporting services to claim a deadline.
const procContext: ProcRegistryContext = {
  time: 1,
  helpers: { balanceProfilesById: new Map() },
  query: {
    timeline: {
      rechargeIntervals: (_skill, start, end) => [{ start, end, rate: 1 }]
    }
  }
};
createProcRegistry(() => procContext).claimCooldown('trait', 1, 2);

// Critical sigils need only live equipment, deadline storage and emission; armed state stays private.
export function checkSigilCapabilities(effects: EffectEmissionService) {
  const sigils = createSigilRuntime();
  sigils.criticalHit(
    {
      config: { sigilSets: [{ names: ['Air'] }] },
      activeWeaponSet: 1,
      procs: createProcRegistry(() => procContext),
      effects
    },
    { type: 'damage', at: 1, source: 'Fixture', sourceId: 'hit', actorType: 'player', coefficient: 1 },
    { chance: 1, didCrit: true }
  );
  // @ts-expect-error Callers cannot arm or consume Doom outside its owner.
  sigils.doomPending = true;
}

// @ts-expect-error Proc claims cannot schedule work through their context.
procContext.queue.enqueue({});
// @ts-expect-error Proc claims cannot depend on unrelated damage queries.
procContext.query.statsAt(1);

// Modifier observations support detached profession state without constructing a simulation runtime.
const modifierContext: Gw2ModifierContext = {
  catalog: createCanonicalCatalog(),
  time: 1,
  state: { profession: { core: {} } }
};
// @ts-expect-error Modifier state exposes no command cursor.
modifierContext.state?.cursor;
// @ts-expect-error Modifier state exposes no proc mutation service.
modifierContext.state?.procs.setDeadline('trait', 0);
// @ts-expect-error Modifier observations cannot clear the live boon store.
modifierContext.state?.boons?.clear();
