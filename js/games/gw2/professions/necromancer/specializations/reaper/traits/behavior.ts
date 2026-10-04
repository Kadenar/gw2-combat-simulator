import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, ConditionEffect } from '#gw2/platform/engine/skills/types.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { targetIsChilled } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/** Applies Reaper's Onslaught at the original attribute-conversion position. */
export function modifyReapersOnslaughtAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) && necromancerActiveShroud(context) === 'reaper') {
    const reapersOnslaughtProfile = requireBalanceProfileFromContext(context, TRAIT.REAPERS_ONSLAUGHT);
    result.ferocity += balanceProfileNumber(reapersOnslaughtProfile, 'attributeBonus');
  }
}

// Chilling Nova is gated on the target already being Chilled at the moment of the crit, not just on trait presence.
const chillingNovaCriticalHit = criticalProcHandler<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.chilling-nova',
  chanceOnCriticalHit: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA), 'criticalChance'),
  when: (context, event) =>
    Number(event.coefficient) > 0 && hasTrait(context, TRAIT.CHILLING_NOVA) && targetIsChilled(context, event.at),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA), 'cooldown'),
    readyAt: (context) => context.procs.deadline('necromancer.reaper.chillingNova') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('necromancer.reaper.chillingNova', readyAt);
    }
  },
  handler: (context, event, _details, application) => {
    // Chilling Nova is a discrete strike-and-chill package for each materialized proc.
    const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA);
    const strike = requireEffect(profile, 'strike', 'Strike');
    const chill = requireEffect(profile, 'condition', 'Chilled');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      if (strike) {
        /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
          kind: 'packet',
          event: {
            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.CHILLING_NOVA,
            actorType: 'effect',
            skillName: 'Chilling Nova',
            triggeredBy: event.skillName,
            type: 'damage',
            coefficient: effectNumber(profile, strike, 'coefficient'),
            skillWeapon: 'Unequipped',
            canCrit: false,
            hits: 1,
            ...(event.summonOwner ? { summonOwner: event.summonOwner } : {})
          }
        });
        context.effects.emit({
          kind: 'announcement',
          announcement: { type: 'trait', name: 'Chilling Nova', at: event.at, sourceSkill: event.skillName }
        });
      }
      // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
      else if (chill) queueChillingNovaChill(context, event, profile, chill);
    }
  }
});

function queueChillingNovaChill(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  profile: BalanceProfile,
  chill: ConditionEffect
): void {
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      condition: String(chill.condition),
      stacks: effectNumber(profile, chill, 'stacks'),
      name: 'Chilling Nova — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILLING_NOVA,
      actorType: 'effect',
      skillName: 'Chilling Nova',
      duration: effectNumber(profile, chill, 'duration')
    })
  });
}

/** Resolves Chilling Nova from actual strikes; combo production belongs to the caller's runtime. */
export function reactToReaperDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NativeResolvedDamageDetails = {}
): void {
  // The resolved Nova strike queues its condition after sibling strikes, preserving their pre-Chill state.
  if (event.actorType === 'effect' && event.sourceId === TRAIT.CHILLING_NOVA) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_NOVA);
    const chill = requireEffect(profile, 'condition', 'Chilled');
    if (chill) queueChillingNovaChill(context, event, profile, chill);
  }

  chillingNovaCriticalHit(context, event, details);
}

/** Converts Chilled applications into Deathly Chill's configured condition packet. */
export function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.DEATHLY_CHILL);
    const effect = requireEffect(profile, 'condition', 'Bleeding');
    if (effect) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.DEATHLY_CHILL,
          actorType: 'effect',
          skillName: 'Deathly Chill',
          triggeredBy: event.skillName,
          type: 'condition',
          ownerActorType: 'player',
          name: 'Deathly Chill' + ' - ' + String(effect.condition),
          condition: String(effect.condition),
          stacks: effectNumber(profile, effect, 'stacks'),
          duration: effectNumber(profile, effect, 'duration')
        }
      });
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Deathly Chill', at: event.at, sourceSkill: event.skillName }
      });
    }
  }
}

/** Converts eligible Fear controls into Shivers of Dread's Chill event. */
export function reactToControl(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // controlKind and kind are both checked because fear appears under different fields depending on the event schema version.
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.SHIVERS_OF_DREAD)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.SHIVERS_OF_DREAD);
  const chill = requireEffect(profile, 'condition', 'Chilled');
  if (!chill) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      condition: String(chill.condition),
      stacks: effectNumber(profile, chill, 'stacks'),
      name: 'Shivers of Dread — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SHIVERS_OF_DREAD,
      actorType: 'effect',
      skillName: 'Shivers of Dread',
      duration: effectNumber(profile, chill, 'duration')
    })
  });
}
