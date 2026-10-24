import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import {
  NECROMANCER_SIGNET_PASSIVES,
  applyNecromancerSignetPassive
} from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';

/** Each signet owns an independent cadence; suppression never advances resources or shifts the anchor. */
function defineSignetPassive(passive: 'undeath' | 'vampirism') {
  return definePeriodicTask<NecromancerRuntime>({
    name: `necromancer.signet-of-${passive}`,
    background: true,
    priority: -10,
    state: (runtime) => runtime.profession.core.signetPassives[passive],
    rearmBeforeRun: true,
    nextAt(runtime) {
      const state = runtime.profession.core.signetPassives[passive];
      state.deadline = canonicalTime(state.deadline + state.interval);
      return gw2CooldownReadyAt(state.deadline);
    },
    run(runtime) {
      const policy = NECROMANCER_SIGNET_PASSIVES.find((policy) => policy.passive === passive)!;
      applyNecromancerSignetPassive(runtime, policy);
    }
  });
}

const signetPassives = { undeath: defineSignetPassive('undeath'), vampirism: defineSignetPassive('vampirism') };

/** A readiness boundary names scheduled work, never a predicted amount or a replayed gain. */
export function nextNecromancerPassiveGain(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;

  if (cost > state.lifeForce.maximum) return Infinity;

  return Math.min(eternalLifeReadyAt(runtime, cost), state.signetPassives.undeath.nextAt);
}

/** Selected passive producers each begin with one bounded wake, including out-of-combat resource pulses. */
export function initializeNecromancerPassives(runtime: NecromancerRuntime): void {
  runtime.fireTrigger(necromancerPassivesStarting);
  const selected = selectedSkillIdSet(runtime.config.selectedSkillIds);
  for (const { passive, skillId, profileId } of NECROMANCER_SIGNET_PASSIVES) {
    if (!selected.has(skillId)) continue;

    const profile = requireBalanceProfileFromContext(runtime, profileId);
    const interval = balanceProfileNumber(profile, 'pulseInterval');

    // A removed resource grant cannot advertise an endless sequence of unaffordable retries.
    if (passive !== 'vampirism' && balanceProfileNumber(profile, 'lifeForceGain') === 0) continue;

    if (interval > 0) {
      const state = runtime.profession.core.signetPassives[passive];
      state.interval = interval;
      state.deadline = interval;
      signetPassives[passive].restart(runtime, gw2CooldownReadyAt(state.deadline));
    }
  }

  runtime.fireTrigger(necromancerPassivesInitialized);
}

/** Passive resource and allied loops remain ambient while an isolated cast settles. */
export const necromancerPassiveLifecycle = {
  backgroundTasks: [...signetPassives.undeath.hooks.backgroundTasks, ...signetPassives.vampirism.hooks.backgroundTasks],
  tasks: { ...signetPassives.undeath.hooks.tasks, ...signetPassives.vampirism.hooks.tasks }
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;

/** Keep the original reward order at the passives-initialized boundary. */
export const necromancerPassivesInitialized = defineTriggerPoint<Record<string, never>>(
  'necromancer.passives-initialized',
  [TRAIT.VAMPIRIC_PRESENCE]
);

/** Trait loop admission precedes signet scheduling to preserve same-time resource ordering. */
export const necromancerPassivesStarting = defineTriggerPoint<Record<string, never>>('necromancer.passives-starting', [
  TRAIT.ETERNAL_LIFE
]);

/** Readiness advertises only the actual next pulse when its threshold can cover the cost. */
function eternalLifeReadyAt(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  const eternal = state.eternalLife.nextAt;
  const threshold = Number.isFinite(eternal)
    ? state.lifeForce.maximum * balanceNumberFromContext(runtime, TRAIT.ETERNAL_LIFE, 'threshold')
    : 0;
  return !state.activeShroud && cost <= threshold ? eternal : Infinity;
}
