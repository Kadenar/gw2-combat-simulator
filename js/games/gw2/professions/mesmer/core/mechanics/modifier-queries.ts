import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

/** Shared event ownership and applied-buff queries keep trait rules independent of module assembly. */
export function illusionSource(context: Gw2ModifierContext): boolean {
  return ['clone', 'phantasm'].includes(context.event?.summonKind || '');
}

export function timedStacks(context: Gw2ModifierContext, kind: string, duration: number, maximum: number): number {
  // Live state cannot borrow an unaccepted scheduled grant; isolated previews retain authored fallback durations.
  return activeBuffStacks(context, kind, maximum, { actor: 'player' }, duration);
}
