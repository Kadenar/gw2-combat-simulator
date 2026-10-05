import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

interface ElementalistAttunementPolicy {
  readonly weaponGate: 'core' | 'elite';
  readonly secondaryAttunement: ElementalistAttunement | null;
}

/** Only the selected Weaver delegates weapon gating to dual-attunement rules. */
export function elementalistAttunementPolicy(
  context: MechanicQueriesOf<ElementalistRuntime>
): ElementalistAttunementPolicy {
  const specialization = context.profession.specialization;
  return specialization.kind === 'Weaver'
    ? { weaponGate: 'elite', secondaryAttunement: specialization.state.secondaryAttunement }
    : { weaponGate: 'core', secondaryAttunement: null };
}
