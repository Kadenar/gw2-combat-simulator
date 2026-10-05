import { buffApplicationStacks, isStandardBoon } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

export type EffectRecipient =
  { readonly actor: 'player' } | { readonly actor: 'companion'; readonly companionId: string | null };

/** Read one recipient's accepted grants; only isolated previews may read scheduled applications. */
export function appliedEffectStacks(
  context: Pick<Gw2ModifierContext, 'runtime' | 'timeline' | 'time'>,
  kind: string,
  maximum: number,
  recipient: EffectRecipient = { actor: 'player' },
  fallbackDuration = 0
): number {
  kind = kind.toLowerCase();
  const audience = recipient.actor === 'player' ? 'all' : 'summon';
  const companionId = recipient.actor === 'companion' ? recipient.companionId : undefined;
  // A retired entity has no live boons or buffs; earlier queries still see its accepted grants.
  if (companionId && context.time >= (context.runtime?.retiredCompanions?.get(companionId) ?? Infinity)) return 0;
  if (!context.runtime)
    return context.timeline?.buffStacksAt(kind, context.time, fallbackDuration, maximum, audience, companionId) ?? 0;
  const applications = (isStandardBoon(kind) ? context.runtime.boons : context.runtime.buffs)?.get(kind) ?? [];
  return buffApplicationStacks(applications, kind, context.time, maximum, { audience, companionId });
}
