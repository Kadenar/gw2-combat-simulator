import { professionCoreState } from '../../../platform/engine/profession.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '../types.js';

export function handleThiefState(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  const incoming = structuredClone(event.state || {}) as Record<string, unknown>;
  const core = professionCoreState(context) as unknown as Record<string, unknown>;
  const specialization = context.profession.specialization.state as unknown as Record<string, unknown>;
  const ownerFor = (key: string): Record<string, unknown> =>
    Object.hasOwn(specialization, key) ? specialization : core;
  const preserved: Record<string, unknown> = {
    traitProcProgress: core.traitProcProgress || {},
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  for (const generationField of Object.keys(incoming).filter((key) => key.endsWith('Generation'))) {
    const prefix = generationField.slice(0, -'Generation'.length);
    const chargesField = `${prefix}Charges`;
    const expiresAtField = `${prefix}ExpiresAt`;
    const owner = ownerFor(generationField);
    const incomingGeneration = Number(incoming[generationField] || 0);
    const currentGeneration = Number(owner[generationField] || 0);
    if (generationField === 'spiderVenomGeneration' && incomingGeneration < currentGeneration) {
      preserved[generationField] = owner[generationField] || 0;
      if (Object.hasOwn(owner, chargesField)) {
        preserved[chargesField] = owner[chargesField] || 0;
      }

      if (Object.hasOwn(owner, expiresAtField)) {
        preserved[expiresAtField] = owner[expiresAtField] || 0;
      }

      continue;
    }

    if (
      incomingGeneration === currentGeneration &&
      Number(incoming[expiresAtField] || 0) > event.at &&
      Object.hasOwn(owner, chargesField)
    ) {
      preserved[chargesField] = owner[chargesField] || 0;
    }
  }

  for (const [key, value] of Object.entries(incoming)) {
    ownerFor(key)[key] = value;
  }

  for (const [key, value] of Object.entries(preserved)) {
    ownerFor(key)[key] = value;
  }
}
