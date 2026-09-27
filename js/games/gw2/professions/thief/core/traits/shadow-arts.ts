import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

const VENOM_SKILL_IDS = new Set<number>([ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM]);

function enqueueSiphon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  sourceId: SkillId,
  name: string,
  coefficient: number,
  flatStrikeBase?: number
): void {
  context.queue.enqueue(
    buildResolverStrike({
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
      noCrit: true,
      damageKind: 'life-steal',
      triggeredBy: event.skillName
    })
  );
}

export function applyLeechingVenoms(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (!hasTrait(context.config, TRAIT.LEECHING_VENOMS)) return;
  const leechingVenomsProfile = requireBalanceProfileFromContext(context, PROFILE.leechingVenoms);
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
    Number(application.metadata?.venomProcEffectIndex || 0) !== 0
  )
    return;
  applyLeechingVenoms(context, application);
}
