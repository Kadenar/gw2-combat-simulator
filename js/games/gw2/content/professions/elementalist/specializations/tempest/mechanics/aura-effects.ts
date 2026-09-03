/**
 * Owns Tempest resolver reactions to accepted Elementalist auras.
 * Core aura application and shared resolver helpers remain under Core mechanics.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ElementalistResolverContext } from '#gw2/content/professions/elementalist/types.js';
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/content/professions/elementalist/core/mechanics/reactions.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/tempest/profiles.js';

/**
 * Convert resolved auras into Tempest trait boons and effects after the aura has been accepted by
 * the core resolver: refreshes Tempestuous Aria's damage window and queues the Invigorating
 * Torrents and Elemental Bastion boons, recording each trait that fired as a proc.
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

  // Balance data supplies the boon name/stacks/duration; the literal pair is the fallback identity.
  if (hasTrait(context, 'Invigorating Torrents')) {
    for (const [name, kind] of [
      ['Vigor', 'Vigor'],
      ['Regeneration', 'Regeneration']
    ] as const) {
      const effect = balanceProfileEffectFromContext(context, PROFILE.invigoratingTorrents, 'boon', 0, name);
      queueElementalistBuff(
        context,
        event,
        String(effect?.boon || kind),
        Number(effect?.stacks ?? 1),
        Number(effect?.duration ?? 5),
        elementalistSourceSkill(event)
      );
    }

    recordElementalistTraitProc(context, event, 'Invigorating Torrents');
  }

  if (hasTrait(context, 'Elemental Bastion')) {
    const alacrity = balanceProfileEffectFromContext(context, PROFILE.elementalBastion, 'boon', 0, 'Alacrity');
    queueElementalistBuff(
      context,
      event,
      String(alacrity?.boon || 'Alacrity'),
      Number(alacrity?.stacks ?? 1),
      Number(alacrity?.duration ?? 4),
      elementalistSourceSkill(event)
    );
    recordElementalistTraitProc(context, event, 'Elemental Bastion');
  }
}
