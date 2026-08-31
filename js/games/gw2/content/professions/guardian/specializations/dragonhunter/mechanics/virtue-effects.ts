import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import { reactToJusticeHitWithOptions } from '#gw2/content/professions/guardian/core/mechanics/virtues.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/content/professions/guardian/types.js';
import { dragonhunterState } from '#gw2/content/professions/guardian/specializations/dragonhunter/state.js';
import {
  guardianBalanceProfile,
  guardianBalanceProfileEffect
} from '#gw2/content/professions/guardian/core/profiles.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/dragonhunter/profiles.js';

function handleTetherApplied(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // Falls back to event.at (no tether window) when tetherUntil was not emitted,
  // rather than NaN-poisoning all subsequent tether comparisons.
  dragonhunterState.from(context).tetherUntil = Number(event.tetherUntil || event.at);
}

function handleTetherBroken(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // Setting tetherUntil = event.at (not 0) preserves any damage packets
  // that land exactly at the break timestamp before the tether expires.
  dragonhunterState.from(context).tetherUntil = event.at;
}

function handleJusticePulse(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const burning = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.tether), 'condition');
  // Justice pulses are pre-emitted for the full tether window at cast time, so
  // each must be re-validated at resolve time in case Hunter's Verdict broke the
  // tether early. Epsilon tolerance avoids rejecting a pulse on the exact break timestamp.
  if (dragonhunterState.from(context).tetherUntil < event.at - Number(context.epsilon || 0.0001)) {
    return;
  }

  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'guardian',
    sourceId: ID.SPEAR_OF_JUSTICE,
    actorType: 'player',
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: 'Spear of Justice',
    name: 'Spear of Justice — Active Burning',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 1),
    duration: Number(burning?.duration || 2),
    applicationIndex: event.applicationIndex,
    totalApplications: event.totalApplications
  });
}

export function reactToDragonhunterJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: { readonly hitContext?: object } = {}
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
    const crippled = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.tether), 'condition', 1);
    context.applyCondition({
      type: 'condition',
      at: event.at,
      source: 'guardian',
      sourceId: ID.SPEAR_OF_JUSTICE,
      actorType: 'player',
      skillId: ID.SPEAR_OF_JUSTICE,
      skillName: 'Spear of Justice',
      name: 'Spear of Justice — Passive Crippled',
      condition: String(crippled?.condition || 'Crippled'),
      stacks: Number(crippled?.stacks || 1),
      duration: Number(crippled?.duration || 1.5)
    });
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
  const vulnerability = guardianBalanceProfileEffect(
    guardianBalanceProfile(context, PROFILE.bigGameHunter),
    'condition'
  );
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    priority: 5,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
    actorType: 'effect',
    skillId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
    skillName: 'Big Game Hunter',
    condition: 'Vulnerability',
    stacks: Number(vulnerability?.stacks || 1),
    duration: Number(vulnerability?.duration || 10),
    triggeredBy: event.skillName
  });
}

export function reactToDragonhunterControl(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = dragonhunterState.from(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.DULLED_SENSES)) {
    const crippled = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.dulledSenses), 'condition');
    // Control-triggered conditions resolve immediately so their reactions
    // share the originating control timestamp.
    context.applyCondition({
      type: 'condition',
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
      skillName: 'Dulled Senses',
      name: 'Dulled Senses — Crippled',
      condition: String(crippled?.condition || 'Crippled'),
      stacks: Number(crippled?.stacks || 1),
      duration: Number(crippled?.duration || 4)
    });
  }

  if (
    !hasTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) ||
    !isInternalCooldownReady(event.at, state.heavyLightReadyAt)
  ) {
    return;
  }

  // 1-second internal cooldown on Heavy Light stability; not exposed by the trait's game tooltip.
  const heavyLight = guardianBalanceProfile(context, PROFILE.heavyLight);
  const stability = guardianBalanceProfileEffect(heavyLight, 'boon');
  state.heavyLightReadyAt = event.at + Number(heavyLight?.internalCooldown || 1);
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    priority: 5,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
    actorType: 'player',
    skillId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
    skillName: 'Heavy Light',
    kind: 'stability',
    stacks: Number(stability?.stacks || 1),
    duration: gw2ResolverBoonDuration(context, event, 'stability', Number(stability?.duration || 6))
  });
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

export const dragonhunterEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: 'guardian.dragonhunter.justice',
      order: 20,
      handler: reactToDragonhunterJusticeHit
    }
  ]),
  control: Object.freeze([
    {
      id: 'guardian.dragonhunter.control',
      order: 20,
      handler: reactToDragonhunterControl
    }
  ])
});
