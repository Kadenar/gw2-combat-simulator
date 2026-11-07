/** Resolves effect labels shared by charts, event logs and calculation details. */
import { standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import type { ProfessionEffectPresentation } from '#gw2/platform/profession-presentation/types.js';
import type { EffectSource } from '#gw2/platform/results/effect-report.js';

/** Finds the active profession contribution for an internal effect kind. */
function effectPresentation(
  kind: unknown,
  presentations: readonly ProfessionEffectPresentation[]
): ProfessionEffectPresentation | undefined {
  const key = String(kind || '').toLowerCase();
  return presentations.find((presentation) => presentation.kind.toLowerCase() === key);
}

/** Resolve labels from compact source fields shared by chart records and full event-log entries. */
export function effectName(
  kind: unknown,
  event: Partial<EffectSource> = {},
  presentations: readonly ProfessionEffectPresentation[] = []
): string {
  const key = String(kind || '');
  const professionPresentation = effectPresentation(key, presentations);

  if (professionPresentation) {
    const name =
      typeof professionPresentation.name === 'function'
        ? professionPresentation.name(event)
        : professionPresentation.name;

    if (name) return name;
  }

  const standardBoon = standardBoonPresentation(key);

  if (standardBoon) return standardBoon.name;

  return key
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join(' ');
}
