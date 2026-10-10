import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  NECROMANCER_SIGNET_PASSIVES,
  applyNecromancerSignetPassive
} from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const PASSIVE = 'necromancer.resource-passive';

type Passive = 'undeath' | 'vampirism';
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
  runtime.fireTrigger(necromancerPassivesStarting, { at: runtime.time });
  const selected = selectedSkillIdSet(runtime.config.selectedSkillIds);
  for (const { passive, skillId, profileId } of NECROMANCER_SIGNET_PASSIVES) {
    if (!selected.has(skillId)) continue;
    const profile = requireBalanceProfileFromContext(runtime, profileId);
    const interval = balanceProfileNumber(profile, 'pulseInterval');
    // A removed resource grant cannot advertise an endless sequence of unaffordable retries.
    if (passive !== 'vampirism' && balanceProfileNumber(profile, 'lifeForceGain') === 0) continue;
    if (interval > 0) schedulePassive(runtime, { passive, interval, deadline: interval });
  }

  runtime.fireTrigger(necromancerPassivesInitialized, { at: runtime.time });
}

export const necromancerPassiveTasks = { [PASSIVE]: passivePulse };

/** Keep the original reward order at the passives-initialized boundary. */
export const necromancerPassivesInitialized = defineTriggerPoint<{ readonly at: number }>(
  'necromancer.passives-initialized',
  [TRAIT.VAMPIRIC_PRESENCE]
);

/** Trait loop admission precedes signet scheduling to preserve same-time resource ordering. */
export const necromancerPassivesStarting = defineTriggerPoint<{ readonly at: number }>(
  'necromancer.passives-starting',
  [TRAIT.ETERNAL_LIFE]
);

/** Readiness advertises only the actual next pulse when its threshold can cover the cost. */
function eternalLifeReadyAt(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  const eternal = state.passiveNextAt['eternal-life'];
  const threshold =
    eternal == null
      ? 0
      : state.lifeForce.maximum *
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE), 'threshold');
  return !state.activeShroud && cost <= threshold ? (eternal ?? Infinity) : Infinity;
}
