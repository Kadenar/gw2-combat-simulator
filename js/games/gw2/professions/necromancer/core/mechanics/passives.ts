import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireEffect,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/hooks.js';
import {
  reactToVampiricPresenceAlliedHit,
  reactToTasteForBloodAlliedHit
} from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

const PASSIVE = 'necromancer.resource-passive';
const ALLIED = 'necromancer.allied-opportunity';
type Passive = 'eternal-life' | 'undeath' | 'vampirism';
interface PassivePulse {
  passive: Passive;
  interval: number;
  deadline: number;
}
interface AlliedPulse {
  trait: number;
  interval: number;
}

function schedulePassive(runtime: NecromancerRuntime, pulse: PassivePulse): void {
  const at = gw2CooldownReadyAt(pulse.deadline);
  runtime.profession.core.passiveNextAt[pulse.passive] = at;
  runtime.schedule(PASSIVE, at, pulse, undefined, -10);
}

/** Only actual pulses grant resources; suppression and overflow preserve the authored cadence. */
function passivePulse(runtime: NecromancerRuntime, data: unknown): void {
  const pulse = data as PassivePulse;
  const state = runtime.profession.core;
  schedulePassive(runtime, { ...pulse, deadline: canonicalTime(pulse.deadline + pulse.interval) });
  if (pulse.passive === 'eternal-life') {
    if (state.activeShroud) return;
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE);
    const missing = Math.max(
      0,
      state.lifeForce.maximum * balanceProfileNumber(profile, 'threshold') - state.lifeForce.value
    );
    runtime.resourceController.grant(
      'lifeForce',
      Math.min(missing, (state.lifeForce.maximum * balanceProfileNumber(profile, 'lifeForceGain')) / 100)
    );
    return;
  }

  const id = pulse.passive === 'undeath' ? ID.SIGNET_OF_UNDEATH : ID.SIGNET_OF_VAMPIRISM;
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  if ((runtime.cooldowns.get(id) ?? 0) > runtime.time && !(hasTrait(runtime, TRAIT.SIGNETS_OF_SUFFERING) && inShroud))
    return;
  const profile = requireBalanceProfileFromContext(
    runtime,
    pulse.passive === 'undeath' ? PROFILE.signetOfUndeathPassive : PROFILE.signetOfVampirismPassive
  );
  if (pulse.passive === 'undeath') grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
  else {
    const strike = requireEffect(profile, 'strike', 'Signet of Vampirism - Passive Life Siphon');
    if (strike)
      runtime.emit(
        buildResolverStrike({
          at: runtime.time,
          source: 'necromancer',
          sourceId: id,
          actorType: 'effect',
          skillId: id,
          skillName: strike.name,
          coefficient: 0,
          skillWeapon: 'Unequipped',
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
          noCrit: strike.noCrit === true,
          damageKind: String(strike.damageKind || '')
        })
      );
  }
}

/** A readiness boundary names scheduled work, never a predicted amount or a replayed gain. */
export function nextNecromancerPassiveGain(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  if (cost > state.lifeForce.maximum) return Infinity;
  const eternal = state.passiveNextAt['eternal-life'];
  const threshold =
    eternal == null
      ? 0
      : state.lifeForce.maximum *
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE), 'threshold');
  return Math.min(
    !state.activeShroud && cost <= threshold ? (eternal ?? Infinity) : Infinity,
    state.passiveNextAt.undeath ?? Infinity
  );
}

/** Selected passive producers each begin with one bounded wake, including out-of-combat resource pulses. */
export function initializeNecromancerPassives(runtime: NecromancerRuntime): void {
  const selected = selectedSkillNameSet(runtime.config.selectedSkills);
  for (const [passive, enabled, profileId] of [
    ['eternal-life', hasTrait(runtime, TRAIT.ETERNAL_LIFE), TRAIT.ETERNAL_LIFE],
    ['undeath', selected.has('Signet of Undeath'), PROFILE.signetOfUndeathPassive],
    ['vampirism', selected.has('Signet of Vampirism'), PROFILE.signetOfVampirismPassive]
  ] as const) {
    if (!enabled) continue;
    const profile = requireBalanceProfileFromContext(runtime, profileId);
    const interval = balanceProfileNumber(profile, 'pulseInterval');
    // A removed resource grant cannot advertise an endless sequence of unaffordable retries.
    if (passive !== 'vampirism' && balanceProfileNumber(profile, 'lifeForceGain') === 0) continue;
    if (interval > 0) schedulePassive(runtime, { passive, interval, deadline: interval });
  }

  if (!runtime.hasExplicitCombatStart) startNecromancerAlliedOpportunities(runtime);
}

/** Allied opportunities trigger only owned siphons; they add no direct allied strike damage. */
function alliedPulse(runtime: NecromancerRuntime, data: unknown): void {
  if (runtime.deathTime != null) return;
  const pulse = data as AlliedPulse;
  const allies = gw2AlliedPlayerAssumptions(runtime.config);
  const reaction =
    pulse.trait === TRAIT.VAMPIRIC_PRESENCE ? reactToVampiricPresenceAlliedHit : reactToTasteForBloodAlliedHit;
  for (let allyIndex = 1; allyIndex <= allies.count; allyIndex++)
    reaction(runtime, {
      type: 'necromancer.allied-hit',
      at: runtime.time,
      source: 'Trait',
      sourceId: pulse.trait,
      actorType: 'effect',
      skillName: `Allied Player ${allyIndex} Attack`,
      allyIndex
    });
  runtime.schedule(ALLIED, canonicalTime(runtime.time + pulse.interval), pulse, undefined, -200);
}

/** Explicit combat markers anchor allied cadences; without a marker they begin at simulation time zero. */
export function startNecromancerAlliedOpportunities(runtime: NecromancerRuntime): void {
  const allies = gw2AlliedPlayerAssumptions(runtime.config);
  if (!allies.count || !allies.strikesPerSecond) return;
  for (const trait of [TRAIT.VAMPIRIC_PRESENCE, TRAIT.OVERFLOWING_THIRST]) {
    if (!hasTrait(runtime, trait)) continue;
    const minimum =
      trait === TRAIT.VAMPIRIC_PRESENCE
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.vampiricPresence), 'cooldown')
        : 0;
    const interval = Math.max(minimum, 1 / allies.strikesPerSecond);
    runtime.schedule(ALLIED, canonicalTime(runtime.time + interval), { trait, interval }, undefined, -200);
  }
}

export const necromancerPassiveTasks = { [PASSIVE]: passivePulse, [ALLIED]: alliedPulse };
