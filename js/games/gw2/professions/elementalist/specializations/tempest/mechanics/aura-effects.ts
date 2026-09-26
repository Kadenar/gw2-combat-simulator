import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
/**
 * Owns Tempest resolver reactions to accepted Elementalist auras.
 * Core aura application and shared resolver helpers remain under Core mechanics.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tempestAuraBoons } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';
import {
  activeElementalistBuffs,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/**
 * Convert resolved auras into Tempest trait boons and effects after the aura has been accepted by
 * the core resolver: refreshes Tempestuous Aria's damage window and queues the Invigorating
 * Torrents and Elemental Bastion boons for resolver-owned auras, recording each trait that fired as a proc.
 */
export function applyTempestResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, 'Tempestuous Aria')) {
    const tempestuousAriaProfile = requireBalanceProfileFromContext(context, PROFILE.tempestuousAria);
    const extension = balanceProfileNumber(tempestuousAriaProfile, 'durationMultiplier');
    const maximum = balanceProfileNumber(tempestuousAriaProfile, 'maximumStacks');
    // Extend the newest live application instead of stacking a second one, clamping the new expiry
    // to the maximum window measured from this aura; with none live, start a fresh application.
    const current = activeElementalistBuffs(context, 'Tempestuous Aria', event.at).at(-1);
    if (current) {
      refreshElementalistBuffs(context, 'Tempestuous Aria', event.at, (expiresAt) =>
        expiresAt === current.expiresAt ? Math.min(event.at + maximum, expiresAt + extension) : expiresAt
      );
    } else {
      queueElementalistBuff(context, event, 'Tempestuous Aria', 1, extension, resolverSourceSkill(event));
    }

    recordElementalistTraitProc(context, event, 'Tempestuous Aria');
  }

  // Both skill and combo auras grant their trait boons only after actual application.
  for (const trait of ['Invigorating Torrents', 'Elemental Bastion'] as const) {
    if (!hasTrait(context, trait)) continue;
    const boons = tempestAuraBoons(context, trait);
    for (const boon of boons) {
      queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, resolverSourceSkill(event));
    }

    if (boons.length) recordElementalistTraitProc(context, event, trait);
  }
}
