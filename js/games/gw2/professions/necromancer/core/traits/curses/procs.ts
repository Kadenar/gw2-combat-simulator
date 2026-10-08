import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { transfer } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { emitNecromancerShroudTrait } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** React to accepted combat and shroud events while retaining trait cooldowns and transfer ownership. */

/** Lets player and Ritualist spirit critical hits advance Barbed Precision, while excluding minions. */
export const necromancerBarbedPrecisionReaction = criticalProcHandler<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.barbed-precision',
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BARBED_PRECISION),
  randomStream: 'necromancer.barbed-precision',
  when: (context, event) =>
    Number(event.coefficient) > 0 &&
    hasTrait(context, TRAIT.BARBED_PRECISION) &&
    (event.actorType !== 'summon' || event.summonKind === 'spirit'),
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION);
      const effect = requireEffect(profile, 'condition', 'Bleeding');
      if (!effect) return;
      {
        /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
          kind: 'packet',
          settlement: 'reaction',
          event: {
            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.BARBED_PRECISION,
            actorType: 'effect',
            skillName: 'Barbed Precision',
            triggeredBy: event.skillName,
            type: 'condition',
            ownerActorType: 'player',
            name: 'Barbed Precision' + ' - ' + String(effect.condition),
            condition: String(effect.condition),
            stacks: effectNumber(profile, effect, 'stacks'),
            duration: effectNumber(profile, effect, 'duration'),
            metadata: { procCount: 1 }
          }
        });
        context.effects.emit({
          kind: 'announcement',
          announcement: { type: 'trait', name: 'Barbed Precision', at: event.at, sourceSkill: event.skillName }
        });
      }
    }
  }
});

export function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_DARKNESS);
  const effect = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // Chill, so a removed packet leaves it ready.
  if (!effect || !context.procs.claimCooldown('chillingDarkness', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.CHILLING_DARKNESS,
        actorType: 'effect',
        skillName: 'Chilling Darkness',
        triggeredBy: event.skillName,
        type: 'condition',
        ownerActorType: 'player',
        name: 'Chilling Darkness' + ' - ' + effect.condition || 'Chilled',
        condition: effect.condition || 'Chilled',
        stacks: effect.stacks ?? 1,
        duration: effect.duration ?? 2
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Chilling Darkness', at: event.at, sourceSkill: event.skillName }
    });
  }
}

export function applyInsidiousDisruption(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.INSIDIOUS_DISRUPTION);
  const effect = requireEffect(profile, 'condition', 'Torment');
  if (!effect) return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.INSIDIOUS_DISRUPTION,
        actorType: 'effect',
        skillName: 'Insidious Disruption',
        triggeredBy: event.skillName,
        type: 'condition',
        ownerActorType: 'player',
        name: 'Insidious Disruption' + ' - ' + String(effect.condition),
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Insidious Disruption', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Emits furious demise at the ordered post-entry boundary. */
export function enterFuriousDemise(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.FURIOUS_DEMISE);
}

/** Emits weakening shroud at the ordered post-entry boundary. */
export function enterWeakeningShroud(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.WEAKENING_SHROUD);
}

/** Shroud variants decide when to arm; the trait owns selection while a granted transfer survives until consumed. */
export function armPlagueSending(runtime: NecromancerRuntime, hasConditions: boolean): void {
  runtime.profession.core.plagueSendingArmed = hasTrait(runtime, TRAIT.PLAGUE_SENDING) && hasConditions;
}

export function reactToNecromancerConditions(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(runtime.helpers, event);
  if (!skill) return;
  const work = { skillId: skill.id, activationId: event.activationId };
  const state = runtime.profession.core;
  if (
    state.plagueSendingArmed &&
    transfer(
      runtime,
      skill,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PLAGUE_SENDING), 'maximumConditions'),
      work,
      true
    )
  ) {
    state.plagueSendingArmed = false;
  }
}

/** Scourge shroud-like casts arm the existing transfer without resetting an already armed unselected grant. */
export function armScourgePlagueSending(runtime: NecromancerRuntime): void {
  if (hasTrait(runtime, TRAIT.PLAGUE_SENDING)) runtime.profession.core.plagueSendingArmed = true;
}
