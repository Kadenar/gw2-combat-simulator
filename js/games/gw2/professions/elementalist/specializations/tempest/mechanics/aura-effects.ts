/**
 * Owns Tempest resolver reactions to accepted Elementalist auras.
 * Core aura application and shared resolver helpers remain under Core mechanics.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { tempestAuraBoons } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
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
    const extension = balanceProfileValueFromContext(context, PROFILE.tempestuousAria, 'durationMultiplier', 5);
    const maximum = balanceProfileValueFromContext(context, PROFILE.tempestuousAria, 'maximumStacks', 10);
    // Extend the newest live application instead of stacking a second one, clamping the new expiry
    // to the maximum window measured from this aura; with none live, start a fresh application.
    const current = activeElementalistBuffs(context, 'Tempestuous Aria', event.at).at(-1);
    if (current) {
      refreshElementalistBuffs(context, 'Tempestuous Aria', event.at, (expiresAt) =>
        expiresAt === current.expiresAt ? Math.min(event.at + maximum, expiresAt + extension) : expiresAt
      );
    } else {
      queueElementalistBuff(context, event, 'Tempestuous Aria', 1, extension, elementalistSourceSkill(event));
    }

    recordElementalistTraitProc(context, event, 'Tempestuous Aria');
  }

  // Scheduled auras already carry their boon grants; Aria's resolver-owned window still updates above.
  if (event.elementalistResolverGeneratedAura !== true && event.type !== 'aura') return;

  for (const trait of ['Invigorating Torrents', 'Elemental Bastion'] as const) {
    if (!hasTrait(context, trait)) continue;
    for (const boon of tempestAuraBoons(context, trait)) {
      queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, elementalistSourceSkill(event));
    }

    recordElementalistTraitProc(context, event, trait);
  }
}
