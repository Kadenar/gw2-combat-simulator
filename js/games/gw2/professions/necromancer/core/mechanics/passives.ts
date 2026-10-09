import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  NECROMANCER_SIGNET_PASSIVES,
  applyNecromancerSignetPassive
} from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { startNecromancerAlliedOpportunities } from '#gw2/professions/necromancer/core/traits/blood-magic/life-steal.js';
import {
  applyEternalLifePulse,
  eternalLifePassive,
  eternalLifeReadyAt
} from '#gw2/professions/necromancer/core/traits/soul-reaping/life-force.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const PASSIVE = 'necromancer.resource-passive';

type Passive = 'eternal-life' | 'undeath' | 'vampirism';
interface PassivePulse {
  passive: Passive;
  interval: number;
  deadline: number;
}

function schedulePassive(runtime: NecromancerRuntime, pulse: PassivePulse): void {
  const at = gw2CooldownReadyAt(pulse.deadline);
  runtime.profession.core.passiveNextAt[pulse.passive] = at;
  runtime.schedule(PASSIVE, at, pulse, undefined, -10);
}

/** Only actual pulses grant resources; suppression and overflow preserve the authored cadence. */
function passivePulse(runtime: NecromancerRuntime, data: unknown): void {
  const pulse = data as PassivePulse;
  schedulePassive(runtime, { ...pulse, deadline: canonicalTime(pulse.deadline + pulse.interval) });
  if (pulse.passive === 'eternal-life') {
    applyEternalLifePulse(runtime);
    return;
  }

  const policy = NECROMANCER_SIGNET_PASSIVES.find((policy) => policy.passive === pulse.passive)!;
  applyNecromancerSignetPassive(runtime, policy);
}

/** A readiness boundary names scheduled work, never a predicted amount or a replayed gain. */
export function nextNecromancerPassiveGain(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  if (cost > state.lifeForce.maximum) return Infinity;
  return Math.min(eternalLifeReadyAt(runtime, cost), state.passiveNextAt.undeath ?? Infinity);
}

/** Selected passive producers each begin with one bounded wake, including out-of-combat resource pulses. */
export function initializeNecromancerPassives(runtime: NecromancerRuntime): void {
  const selected = selectedSkillIdSet(runtime.config.selectedSkillIds);
  for (const [passive, enabled, profileId] of [
    eternalLifePassive(runtime),
    ...NECROMANCER_SIGNET_PASSIVES.map(
      (policy) => [policy.passive, selected.has(policy.skillId), policy.profileId] as const
    )
  ] as const) {
    if (!enabled) continue;
    const profile = requireBalanceProfileFromContext(runtime, profileId);
    const interval = balanceProfileNumber(profile, 'pulseInterval');
    // A removed resource grant cannot advertise an endless sequence of unaffordable retries.
    if (passive !== 'vampirism' && balanceProfileNumber(profile, 'lifeForceGain') === 0) continue;
    if (interval > 0) schedulePassive(runtime, { passive, interval, deadline: interval });
  }

  startNecromancerAlliedOpportunities(runtime);
}

export const necromancerPassiveTasks = { [PASSIVE]: passivePulse };
