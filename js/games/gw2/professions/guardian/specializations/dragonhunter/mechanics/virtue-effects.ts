import { buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { onResolvedDamage, onResolvedControl } from '#gw2/platform/profession-definition/mechanics.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';

function handleTetherApplied(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // Falls back to event.at (no tether window) when tetherUntil was not emitted,
  // rather than NaN-poisoning all subsequent tether comparisons.
  dragonhunterState.from(context).tetherUntil = canonicalTime(Number(event.tetherUntil || event.at));
}

function handleTetherBroken(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // Setting tetherUntil = event.at (not 0) preserves any damage packets
  // that land exactly at the break timestamp before the tether expires.
  dragonhunterState.from(context).tetherUntil = event.at;
}

function handleJusticePulse(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const tetherProfile = requireBalanceProfileFromContext(context, PROFILE.tether);
  const burning = requireEffect(tetherProfile, 'condition', 'Burning');
  if (!burning) return;
  // Justice pulses are pre-emitted for the full tether window at cast time, so
  // each must be re-validated at resolve time in case Hunter's Verdict broke the
  // tether early. Pulses exactly at the break timestamp still land.
  if (dragonhunterState.from(context).tetherUntil < event.at) {
    return;
  }

  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId: ID.SPEAR_OF_JUSTICE,
      actorType: 'player',
      skillId: ID.SPEAR_OF_JUSTICE,
      skillName: 'Spear of Justice',
      name: 'Spear of Justice — Active Burning',
      condition: String(burning.condition),
      stacks: effectNumber(tetherProfile, burning, 'stacks'),
      duration: effectNumber(tetherProfile, burning, 'duration'),
      applicationIndex: event.applicationIndex,
      totalApplications: event.totalApplications
    })
  );
}

export function reactToDragonhunterJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  const core = professionCoreState(context);
  const passiveBefore = Number(core.justicePassiveBurns || 0);
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: false,
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: 'Spear of Justice'
  });

  // Passive Crippled only fires when the passive burn counter actually incremented,
  // i.e. a new passive Justice proc occurred on this hit (not an active proc).
  if (Number(core.justicePassiveBurns || 0) > passiveBefore) {
    const tetherProfile = requireBalanceProfileFromContext(context, PROFILE.tether);
    const crippled = requireEffect(tetherProfile, 'condition', 'Crippled (passive)');
    if (crippled) {
      context.applyCondition(
        buildResolverCondition({
          at: event.at,
          source: 'guardian',
          sourceId: ID.SPEAR_OF_JUSTICE,
          actorType: 'player',
          skillId: ID.SPEAR_OF_JUSTICE,
          skillName: 'Spear of Justice',
          name: 'Spear of Justice — Passive Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(tetherProfile, crippled, 'stacks'),
          duration: effectNumber(tetherProfile, crippled, 'duration')
        })
      );
    }
  }

  if (
    !hasTrait(context, GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER) ||
    dragonhunterState.from(context).tetherUntil <= event.at ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0)
  ) {
    return;
  }

  // priority: 5 ensures this Vulnerability condition sorts after zero-priority damage
  // events at the same timestamp so modifiers can pick it up on the next resolve tick.
  const bigGameHunterProfile = requireBalanceProfileFromContext(context, PROFILE.bigGameHunter);
  const vulnerability = requireEffect(bigGameHunterProfile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
      skillName: 'Big Game Hunter',
      condition: 'Vulnerability',
      stacks: effectNumber(bigGameHunterProfile, vulnerability, 'stacks'),
      duration: effectNumber(bigGameHunterProfile, vulnerability, 'duration'),
      triggeredBy: event.skillName
    })
  );
}

export function reactToDragonhunterControl(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = dragonhunterState.from(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.DULLED_SENSES)) {
    const dulledSensesProfile = requireBalanceProfileFromContext(context, PROFILE.dulledSenses);
    const crippled = requireEffect(dulledSensesProfile, 'condition', 'Crippled');
    // Control-triggered conditions resolve immediately so their reactions
    // share the originating control timestamp.
    if (crippled) {
      context.applyCondition(
        buildResolverCondition({
          at: event.at,
          source: 'guardian',
          sourceId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
          actorType: 'effect',
          skillId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
          skillName: 'Dulled Senses',
          name: 'Dulled Senses — Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(dulledSensesProfile, crippled, 'stacks'),
          duration: effectNumber(dulledSensesProfile, crippled, 'duration')
        })
      );
    }
  }

  if (
    !hasTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) ||
    !isInternalCooldownReady(event.at, state.heavyLightReadyAt)
  ) {
    return;
  }

  // 1-second internal cooldown on Heavy Light stability; not exposed by the trait's game tooltip.

  const heavyLightProfile = requireBalanceProfileFromContext(context, PROFILE.heavyLight);
  const stability = requireEffect(heavyLightProfile, 'boon', 'stability');
  if (!stability) return;
  state.heavyLightReadyAt = event.at + balanceProfileNumber(heavyLightProfile, 'internalCooldown');
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
      skillName: 'Heavy Light',
      kind: 'stability',
      stacks: effectNumber(heavyLightProfile, stability, 'stacks'),
      duration: effectNumber(heavyLightProfile, stability, 'duration')
    })
  );
  context.recordProc(
    'trait',
    'Heavy Light',
    event.at,
    event.skillName,
    'Stability',
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.HEAVY_LIGHT)
  );
}

export const dragonhunterEventHandlers = Object.freeze({
  'guardian.dragonhunter-tethered': handleTetherApplied,
  'guardian.dragonhunter-tether-broken': handleTetherBroken,
  'guardian.dragonhunter-justice-pulse': handleJusticePulse
});

// Tag reactions here so module composition preserves their stage and registration order.
export const dragonhunterEventReactions = Object.freeze([
  onResolvedDamage({
    id: 'guardian.dragonhunter.justice',
    order: 20,
    handler: reactToDragonhunterJusticeHit
  }),
  onResolvedControl({
    id: 'guardian.dragonhunter.control',
    order: 20,
    handler: reactToDragonhunterControl
  })
]);
