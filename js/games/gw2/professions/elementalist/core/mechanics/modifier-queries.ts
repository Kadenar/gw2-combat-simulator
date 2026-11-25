import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';

// Modifier contexts reach core state through the runtime profession snapshot.
function coreState(context: ElementalistModifierContext): Partial<ElementalistCoreState> {
  return readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
}

// Before any attunement swap is recorded, fall back to the build's start attunement.
export function primaryAttunement(context: ElementalistModifierContext): string {
  return coreState(context).primaryAttunement || context.config?.startAttunement || 'Fire';
}

/** Might stacks at the event's instant, falling back to the build's assumed might. */
export function elementalistMightStacks(context: ElementalistModifierContext): number {
  return Number(
    context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? context.config?.boons?.might ?? 0
  );
}
