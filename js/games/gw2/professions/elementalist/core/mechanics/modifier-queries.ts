import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';
// Modifier contexts reach core state through the runtime profession snapshot.
function coreState(context: ElementalistModifierContext): Partial<ElementalistCoreState> {
  return readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
}

/**
 * The attunements considered active for modifier purposes. Core has only the
 * primary; Weaver extends the returned set with its secondary attunement.
 */
export function elementalistAttunements(context: ElementalistModifierContext): Set<string> {
  const state = coreState(context);
  return new Set([state.primaryAttunement].filter((value): value is ElementalistAttunement => value != null));
}

// Before any attunement swap is recorded, fall back to the build's start attunement.
export function primaryAttunement(context: ElementalistModifierContext): string {
  return coreState(context).primaryAttunement || context.config?.startAttunement || 'Fire';
}

// Conjure attributes belong to the wielder, including utility attacks, only during the equipped copy's lifetime.
export function wieldedConjure(context: ElementalistModifierContext): string | null {
  const state = coreState(context);
  return (state.conjureExpiresAt || 0) > context.time ? state.conjureEquipped || null : null;
}

/** Might stacks at the event's instant, falling back to the build's assumed might. */
export function elementalistMightStacks(context: ElementalistModifierContext): number {
  return Number(
    context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? context.config?.boons?.might ?? 0
  );
}
