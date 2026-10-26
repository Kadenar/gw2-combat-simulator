import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireSkillFromContext, skillNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';

import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';

const SHATTERING_ICE_PACKET = 'elementalist.catalyst.shattering-ice';

/** Accepted Shattering Ice applications rearm its first proc and tick-aligned window. */
export function applyShatteringIce(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();

  if (kind === 'shattering ice' && event.resolvedAudience?.includesSelf) {
    const state = catalystState.from(context);
    state.shatteringIceUntil = gw2EffectExpiresAt(event.at, Math.max(0, event.duration || 0));
    // Refreshing the buff rearms its first strike; subsequent strikes use the canonical strict ICD.
    context.procs.setDeadline('elementalist.catalyst.shatteringIce', 0);
  }
}

/**
 * Spend active Shattering Ice state on player-owned attacks, including fields
 * and effects, while preventing summons and the derived packet from retriggering it.
 *
 * A qualifying hit consumes the skill internal cooldown and queues the strike
 * and chill packets that Shattering Ice owns.
 */
export function applyCatalystResolvedDamage(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const state = catalystState.from(context);

  if (
    (event.actorType !== ACTOR.PLAYER && event.actorType !== ACTOR.EFFECT) ||
    event.metadata?.packetKind === SHATTERING_ICE_PACKET ||
    !(Number(event.coefficient) > 0) ||
    state.shatteringIceUntil <= event.at
  ) {
    return;
  }

  const skill = requireSkillFromContext(context, ID.SHATTERING_ICE);

  // A qualifying hit spends its interval even when both rewards have been explicitly removed.
  if (
    !context.procs.claimCooldown(
      'elementalist.catalyst.shatteringIce',
      event.at,
      skillNumber(skill, 'internalCooldown')
    )
  )
    return;

  const action = requireSkillAction(skill, 'triggered-packet');
  const strike = requireEffect(skill, 'strike', 'Shattering Ice - Triggered Packet', action);
  const chilled = requireEffect(skill, 'condition', CONDITION.CHILLED, action);

  if (strike) {
    context.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        at: event.at,
        source: 'Shattering Ice Proc',
        sourceId: event.skillId ?? event.sourceId,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillName: 'Shattering Ice Proc',
        coefficient: Number(strike.coefficient),
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName,
        metadata: { packetKind: SHATTERING_ICE_PACKET }
      })
    });
  }

  if (chilled) {
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Shattering Ice Proc',
        sourceId: event.skillId ?? event.sourceId,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillName: 'Shattering Ice Proc',
        condition: String(chilled.condition),
        stacks: Number(chilled.stacks),
        duration: Number(chilled.duration),
        triggeredBy: event.skillName
      })
    });
  }
}
