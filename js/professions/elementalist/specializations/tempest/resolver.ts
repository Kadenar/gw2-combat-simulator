import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import type { Gw2ResolverEvent } from '../../../../platform/gw2/types.js';
import type { ElementalistResolverContext } from '../../types.js';
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '../../core/resolver.js';
import { elementalistBalanceValue } from '../../core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export function applyTempestResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Tempestuous Aria')) return;
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
