import { ACTOR } from '#gw2/platform/constants.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

/** Clones, phantasms, and Troubadour afterimages are all illusions for trait and buff ownership. */
export function isIllusionSummonKind(summonKind: string | undefined): boolean {
  return summonKind === 'clone' || summonKind === 'phantasm' || summonKind === 'afterimage';
}

/** Shared event ownership and applied-buff queries keep trait rules independent of module assembly. */
export function illusionSource(context: Gw2ModifierContext): boolean {
  return isIllusionSummonKind(context.event?.summonKind);
}

export function timedStacks(context: Gw2ModifierContext, kind: string, duration: number, maximum: number): number {
  // Live state cannot borrow an unaccepted scheduled grant; isolated previews retain authored fallback durations.
  return activeBuffStacks(context, kind, maximum, { actor: ACTOR.PLAYER }, duration);
}
