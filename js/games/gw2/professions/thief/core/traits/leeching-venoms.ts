import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

export const VENOM_SKILL_IDS = new Set<number>([ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM]);

export function enqueueSiphon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  sourceId: SkillId,
  name: string,
  coefficient: number,
  flatStrikeBase?: number
): void {
  context.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: event.at,
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,
      coefficient,
      // Flat life stealing bypasses armor, weapon strength, critical hits, and ordinary strike multipliers.
      ...(flatStrikeBase == null ? {} : { flatStrikeBase, flatStrikePowerCoeff: coefficient }),

      canCrit: false,
      damageKind: 'life-steal',
      triggeredBy: event.skillName
    })
  });
}

export function applyLeechingVenoms(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (!hasTrait(context.config, TRAIT.LEECHING_VENOMS)) return;
  const leechingVenomsProfile = requireBalanceProfileFromContext(context, TRAIT.LEECHING_VENOMS);
  const strike = requireEffect(leechingVenomsProfile, 'strike', 'Leeching Venoms');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!strike) return;
  enqueueSiphon(
    context,
    event,
    TRAIT.LEECHING_VENOMS,
    'Leeching Venoms',
    effectNumber(leechingVenomsProfile, strike, 'flatStrikePowerCoeff'),
    effectNumber(leechingVenomsProfile, strike, 'flatStrikeBase')
  );
}

export function applyAlliedLeechingVenoms(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    !application.metadata?.triggeredByAlly ||
    !VENOM_SKILL_IDS.has(Number(application.skillId)) ||
    (application.metadata.venomProcEffectIndex || 0) !== 0
  )
    return;
  applyLeechingVenoms(context, application);
}

/** Applies Leeching Venoms at its established mechanical boundary. */
export function grantLeechingVenomCharges(runtime: ThiefRuntime, at: number): void {
  const core = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.LEECHING_VENOMS)) {
    const leeching = requireBalanceProfileFromContext(runtime, TRAIT.LEECHING_VENOMS);
    addVenomCharges(
      core,
      ID.SPIDER_VENOM,
      at,
      balanceProfileNumber(leeching, 'resourceGain'),
      balanceProfileNumber(leeching, 'durationMultiplier'),
      balanceProfileNumber(leeching, 'maximumStacks')
    );
  }
}
