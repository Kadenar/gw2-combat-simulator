import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
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
    return;
  }
}

/**
 * Spend active Shattering Ice state on player-owned attacks, including fields
 * and effects, while preventing summons and the derived packet from retriggering it.
 *
 * A qualifying hit consumes the profile internal cooldown and queues the strike
 * and chill packets that Shattering Ice owns.
 */
export function applyCatalystResolvedDamage(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const state = catalystState.from(context);
  if (
    (event.actorType !== 'player' && event.actorType !== 'effect') ||
    event.metadata?.packetKind === SHATTERING_ICE_PACKET ||
    !(Number(event.coefficient) > 0) ||
    state.shatteringIceUntil <= event.at ||
    !context.procs.claim(PROFILE.shatteringIce, 'elementalist.catalyst.shatteringIce', event.at)
  ) {
    return;
  }

  const shatteringIceProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringIce);
  const strike = requireEffect(shatteringIceProfile, 'strike', 'Shattering Ice - Triggered Packet');
  const chilled = requireEffect(shatteringIceProfile, 'condition', 'Chilled');
  if (strike) {
    context.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        at: event.at,
        source: 'Shattering Ice Proc',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
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
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Shattering Ice Proc',
        condition: String(chilled.condition),
        stacks: Number(chilled.stacks),
        duration: Number(chilled.duration),
        triggeredBy: event.skillName
      })
    });
  }
}
