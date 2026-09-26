import { rangerEvent } from '#gw2/professions/ranger/core/live-events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  isPetStrike,
  isPlayerStrike,
  queueCondition
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerRuntime, RangerResolverContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

// On an eligible heal, consume Child of Earth's ICD and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
export function emitChildOfEarth(context: RangerRuntime, skill: RangerSkill): void {
  const state = professionCoreState(context);
  if (!hasTrait(context, TRAIT.CHILD_OF_EARTH) || !isInternalCooldownReady(context.time, state.childOfEarthReadyAt)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.childOfEarth);
  const immobilized = requireEffect(profile, 'condition', 'Immobilized');
  // Pulse conditions keep their own identities, so removing one never rebinds another.
  const pulses = [requireEffect(profile, 'condition', 'Crippled'), requireEffect(profile, 'condition', 'Slow')].filter(
    (effect) => effect !== undefined
  );
  // The cooldown gates the lesser field; with every packet removed there is nothing to gate.
  if (!immobilized && !pulses.length) return;
  state.childOfEarthReadyAt = context.time + balanceProfileNumber(profile, 'internalCooldown');
  const at = context.time;
  if (immobilized)
    context.emit(
      rangerEvent(
        {
          at,
          source: 'Trait',
          actorType: 'effect',
          skillId: TRAIT.CHILD_OF_EARTH,
          skillName: 'Child of Earth',
          name: 'Lesser Muddy Terrain - Immobilized',
          condition: String(immobilized.condition),
          duration: effectNumber(profile, immobilized, 'duration'),
          stacks: effectNumber(profile, immobilized, 'stacks'),
          triggeredBy: skill.name
        },
        'condition'
      )
    );
  const applications = balanceProfileNumber(profile, 'maximumStacks');
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  for (let application = 0; application < applications; application += 1) {
    for (const effect of pulses) {
      const condition = String(effect.condition);
      context.emit(
        rangerEvent(
          {
            at: at + application * interval,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CHILD_OF_EARTH,
            skillName: 'Child of Earth',
            name: `Lesser Muddy Terrain - ${condition}`,
            condition,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      );
    }
  }
}

export function triggerPoisonMaster(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  if (!state.poisonMasterPetAttackReady || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.poisonMaster);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The armed pet attack exists only to deliver poison, so a removed packet leaves it armed.
  if (!poison) return;
  state.poisonMasterPetAttackReady = false;
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.POISON_MASTER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.POISON_MASTER,
      skillName: 'Poison Master',
      name: 'Poison Master - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  );
}

export function triggerArachnophobia(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    !isPetStrike(event) ||
    !hasTrait(context, TRAIT.ARACHNOPHOBIA) ||
    (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.arachnophobia);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  // Twin Darts splits the trait's per-attack Torment across its two projectiles;
  // single-hit spider Spit keeps the full duration.
  const duration =
    effectNumber(profile, torment, 'duration') / (event.skillId === ID.TWIN_DARTS ? Number(event.totalHits || 2) : 1);
  queueCondition(
    context,
    event,
    String(torment.condition),
    duration,
    effectNumber(profile, torment, 'stacks'),
    TRAIT.ARACHNOPHOBIA,
    'Arachnophobia'
  );
}

// Record the target-control window and dispatch Ranger traits that react to
// canonical control events without replaying the source effect.
export function reactToRangerCoreControl(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CARNIVORE) ||
    (!isPlayerStrike(event) && !isPetStrike(event)) ||
    !isInternalCooldownReady(event.at, state.carnivoreReadyAt)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.carnivore);
  const strike = requireEffect(profile, 'strike', 'Strike');
  // The cooldown gates only the life-steal strike, so a removed strike leaves it ready.
  if (!strike) return;
  state.carnivoreReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
  const hits = effectNumber(profile, strike, 'hits');
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CARNIVORE,
      actorType: 'effect',
      skillId: TRAIT.CARNIVORE,
      skillName: 'Carnivore',

      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits,

      totalHits: hits,
      skillWeapon: 'Unequipped',
      canCrit: false,
      damageKind: 'life-steal',
      triggeredBy: event.skillName
    })
  );
}
