/** Owns imperative Core Necromancer Curses trait behavior for ordered dispatcher calls. */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyTraitCondition } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '#gw2/professions/necromancer/types.js';

/** Preserves Barbed Precision's critical-fact reaction identity and deterministic progress. */
export const necromancerBarbedPrecisionReaction = onResolvedCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: 'necromancer.barbed-precision',
  order: 0,
  materialization: 'threshold',
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) =>
    Number(balanceProfileFromContext(context, PROFILE.barbedPrecision)?.criticalChance ?? 0.33),
  randomStream: 'necromancer.barbed-precision',
  when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.BARBED_PRECISION),
  expectedProgress: {
    get: (context) => professionCoreState(context).barbedPrecisionProgress,
    set: (context, value) => {
      professionCoreState(context).barbedPrecisionProgress = value;
    }
  },
  attribution: { kind: 'trait', id: TRAIT.BARBED_PRECISION },
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.barbedPrecision), 'condition');
      applyTraitCondition(context, event, {
        name: 'Barbed Precision',
        traitId: TRAIT.BARBED_PRECISION,
        condition: String(effect?.condition || 'Bleeding'),
        stacks: Number(effect?.stacks ?? 1),
        duration: Number(effect?.duration ?? 3)
      });
    }
  }
});

export function applyBitterChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition !== 'Chilled' || !hasTrait(context, TRAIT.BITTER_CHILL)) return;
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name: 'Bitter Chill',
    skillName: 'Bitter Chill',
    condition: 'Vulnerability',
    stacks: 3,
    duration: 8,
    source: 'Trait',
    sourceId: TRAIT.BITTER_CHILL,
    actorType: 'effect',
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', 'Bitter Chill', event.at, event.skillName);
}

export function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.CHILLING_DARKNESS) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.chillingDarkness || 0))
  )
    return;
  const profile = balanceProfileFromContext(context, PROFILE.chillingDarkness);
  const effect = balanceProfileEffect(profile, 'condition');
  professionCoreState(context).traitProcReadyAt.chillingDarkness = event.at + Number(profile?.cooldown ?? 3);
  applyTraitCondition(context, event, {
    name: 'Chilling Darkness',
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: String(effect?.condition || 'Chilled'),
    stacks: Number(effect?.stacks ?? 1),
    duration: Number(effect?.duration ?? 2)
  });
}

export function applyTerror(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.TERROR)) return;
  applyTraitCondition(context, event, {
    name: 'Terror',
    traitId: TRAIT.TERROR,
    condition: 'Fear',
    duration: Number(event.duration ?? 1)
  });
}

export function applyInsidiousDisruption(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.insidiousDisruption), 'condition');
  applyTraitCondition(context, event, {
    name: 'Insidious Disruption',
    traitId: TRAIT.INSIDIOUS_DISRUPTION,
    condition: String(effect?.condition || 'Torment'),
    stacks: Number(effect?.stacks ?? 1),
    duration: Number(effect?.duration ?? 5)
  });
}
