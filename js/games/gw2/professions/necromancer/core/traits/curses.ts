import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
/** Owns imperative Core Necromancer Curses trait behavior for ordered dispatcher calls. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber,
  procChanceFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyTraitCondition } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Lets player and Ritualist spirit critical hits advance Barbed Precision, while excluding minions. */
export const necromancerBarbedPrecisionReaction = onResolvedCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.barbed-precision',
  order: 0,
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, PROFILE.barbedPrecision),
  randomStream: 'necromancer.barbed-precision',
  when: (context, event) =>
    Number(event.coefficient) > 0 &&
    hasTrait(context, TRAIT.BARBED_PRECISION) &&
    (event.actorType !== 'summon' || event.summonKind === 'spirit'),
  attribution: { kind: 'trait', id: TRAIT.BARBED_PRECISION },
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.barbedPrecision);
      const effect = requireEffect(profile, 'condition', 'Bleeding');
      if (!effect) return;
      applyTraitCondition(context, event, {
        name: 'Barbed Precision',
        procCount: 1,
        traitId: TRAIT.BARBED_PRECISION,
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      });
    }
  }
});

export function applyBitterChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition !== 'Chilled' || !hasTrait(context, TRAIT.BITTER_CHILL)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.BITTER_CHILL);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      name: 'Bitter Chill',
      skillName: 'Bitter Chill',
      condition: String(vulnerability.condition),
      stacks: effectNumber(profile, vulnerability, 'stacks'),
      duration: effectNumber(profile, vulnerability, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.BITTER_CHILL,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', 'Bitter Chill', event.at, event.skillName);
}

export function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.chillingDarkness);
  const effect = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // Chill, so a removed packet leaves it ready.
  if (
    !effect ||
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'chillingDarkness',
      event.at,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
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
  const profile = requireBalanceProfileFromContext(context, PROFILE.insidiousDisruption);
  const effect = requireEffect(profile, 'condition', 'Torment');
  if (!effect) return;
  applyTraitCondition(context, event, {
    name: 'Insidious Disruption',
    traitId: TRAIT.INSIDIOUS_DISRUPTION,
    condition: String(effect.condition),
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  });
}
