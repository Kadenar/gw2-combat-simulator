import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import {
  applyPersistingFlamesCondition,
  applyPersistingFlamesDamage
} from '#gw2/professions/elementalist/core/traits/persisting-flames.js';
/** Resolver event classification and reaction registration for Core Elementalist behavior. */
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
// Resolver mutations target the owned Core slice of the nested Elementalist runtime.
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { type ElementalistAuraState } from '#gw2/professions/elementalist/core/state.js';
import { applyStrengthOfStone, elementalistAuraDuration } from '#gw2/professions/elementalist/core/traits/behavior.js';
import { applyElementalistResolverAuraTraits } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

export {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

/** Queues a resolver-generated aura after applying Smothering Auras exactly once. */
export function queueElementalistAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  aura: string,
  duration: number,
  skillName: string
): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'elementalist.aura',
      at: event.at,
      source: skillName,
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'effect',
      skillName,
      aura,
      duration: elementalistAuraDuration(context, duration),
      elementalistResolverGeneratedAura: true
    }
  });
}

// Record each aura once, then dispatch Core aura traits before specialization reactions.
export function applyElementalistResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = resolverSourceSkill(event);
  const duration = Math.max(0, event.duration || 0);
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName
  };
  professionCoreState(context).activeAuras.push(auraState);
  if (context.reporting && event.elementalistResolverGeneratedAura === true) context.resolved.push(event);
  if (context.combatStartTime != null && event.at < context.combatStartTime) return;

  {
    applyElementalistResolverAuraTraits(context, event);
  }

  if (event.type === 'elementalist.aura') {
    Object.assign(event, { elementalistAuraReactionDispatched: true });
    context.dispatchReaction('aura.applied', event);
  }
}

/** Arms Shattering Stone only when its self buff reaches the resolver timeline. */
export function applyElementalistResolverBuff(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.kind !== 'shattering stone' || !event.resolvedAudience?.includesSelf) return;
  const core = professionCoreState(context);
  core.shatteringStone = grantCharges(event.stacks || 0, event.at + (event.duration || 0));
}

/** Applies strike reactions in impact order, regardless of when their packets were scheduled. */
export function applyElementalistResolvedDamage(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  applyPersistingFlamesDamage(context, event);

  const core = professionCoreState(context);
  if (
    (event.actorType === 'player' || event.actorType === 'effect') &&
    Number(event.coefficient) > 0 &&
    consumeCharge(core.shatteringStone, event.at)
  ) {
    const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
    const bleeding = requireEffect(shatteringStoneProfile, 'condition', 'Triggered Bleeding');
    if (bleeding) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          type: 'condition',
          at: event.at,
          source: 'Shattering Stone',
          sourceId: ID.SHATTERING_STONE,
          actorType: 'player',
          skillName: 'Shattering Stone',
          condition: String(bleeding.condition),
          stacks: Number(bleeding.stacks),
          duration: Number(bleeding.duration),
          triggeredBy: resolverSourceSkill(event)
        }
      });
    }
  }
}

/** Classifies conditions and preserves Strength of Stone before Persisting Flames. */
export function applyElementalistResolvedCondition(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent
): void {
  if (event.condition === 'Immobilized' && (context.combatStartTime == null || event.at >= context.combatStartTime)) {
    applyStrengthOfStone(context, event);
  }

  applyPersistingFlamesCondition(context, event);
}
