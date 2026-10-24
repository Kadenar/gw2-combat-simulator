import { createProcRegistry, type ProcRegistryContext } from '#gw2/platform/combat/procs/registry.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

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

// @ts-expect-error Proc claims cannot schedule work through their context.
procContext.queue.enqueue({});
// @ts-expect-error Proc claims cannot depend on unrelated damage queries.
procContext.query.statsAt(1);

// Modifier observations support detached profession state without constructing a simulation runtime.
const modifierContext: Gw2ModifierContext = {
  time: 1,
  state: { profession: { core: {} }, boons: new Map() }
};
// @ts-expect-error Modifier state exposes no command cursor.
modifierContext.state?.cursor;
// @ts-expect-error Modifier state exposes no proc mutation service.
modifierContext.state?.procs.setDeadline('trait', 0);
// @ts-expect-error Modifier observations cannot clear the live boon store.
modifierContext.state?.boons?.clear();
