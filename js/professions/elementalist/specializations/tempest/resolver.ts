import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import type { Gw2ResolverEvent } from '../../../../platform/gw2/resolver/types.js';
import type { ElementalistResolverContext } from '../../types.js';
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '../../core/resolver.js';
import { elementalistBalanceEffect, elementalistBalanceValue } from '../../core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Convert resolved auras into Tempest trait boons and effects after the aura has
// been accepted by the core resolver.
export function applyTempestResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, 'Tempestuous Aria')) {
    const extension = elementalistBalanceValue(context, PROFILE.tempestuousAria, 'durationMultiplier', 5);
    const maximum = elementalistBalanceValue(context, PROFILE.tempestuousAria, 'maximumStacks', 10);
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

  if (hasTrait(context, 'Invigorating Torrents')) {
    for (const [name, kind] of [
      ['Vigor', 'Vigor'],
      ['Regeneration', 'Regeneration']
    ] as const) {
      const effect = elementalistBalanceEffect(context, PROFILE.invigoratingTorrents, 'boon', name);
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
    const alacrity = elementalistBalanceEffect(context, PROFILE.elementalBastion, 'boon', 'Alacrity');
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
