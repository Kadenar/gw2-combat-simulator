import { DRAGON_TRIGGER_ENTRY_RESOURCE_REASON } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { ENTER_DRAGON_TRIGGER_REASON } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger-rules.js';
import type { ProfessionChargeReleaseContext } from '#gw2/platform/profession-presentation/types.js';

/** Release choices are actual independent prefix runs, including their pending effects, cooldowns, and charge stalls. */
export function dragonChargeReleaseProjection({ skill, preview }: ProfessionChargeReleaseContext) {
  const unavailable = { rows: [], unavailableMessage: ENTER_DRAGON_TRIGGER_REASON };
  if (!skill || !preview) return unavailable;
  const prefix = preview();
  const state = prefix.planningState.profession as { readonly dragonTriggerActive?: boolean } | null;
  if (!state?.dragonTriggerActive) return unavailable;
  const entry = prefix.events
    .filter((event) => event.type === 'resource' && event.reason === DRAGON_TRIGGER_ENTRY_RESOURCE_REASON)
    .at(-1);
  if (!entry) return unavailable;
  const maximum = Number(entry.maximumCharges);
  const interval = Number(entry.chargesPerInterval);
  if (!(Number.isInteger(maximum) && maximum > 0 && Number.isInteger(interval) && interval > 0))
    throw new TypeError('Dragon Trigger entry must record positive integer charge limits.');
  const levels: number[] = [];
  for (let charges = interval; charges < maximum; charges += interval) levels.push(charges);
  levels.push(maximum);
  const rows = levels.map((charges) => {
    const result = preview({ type: 'cast', skillId: skill.id, releaseAtCharges: charges });
    const step = result.steps.at(-1);
    const release =
      step?.activationId == null
        ? undefined
        : result.events.find(
            (event) =>
              event.type === 'resource' &&
              event.reason === 'profession mechanic' &&
              event.resource === 'dragon charges' &&
              event.activationId === step.activationId
          );
    return {
      charges: release ? Number(release.chargesReached) : charges,
      at: release?.at ?? prefix.planningState.atSeconds,
      delta: release ? release.at - entry.at : 0,
      flowAfter: release ? Number(release.flowAfter) : null,
      coefficient: release ? Number(release.coefficient) : 0,
      disabled: !release,
      reason: release ? '' : (step?.invalidReason ?? 'No release occurred at this insertion point.')
    };
  });
  // Waiting for another gate can make several thresholds release the same actual charge count.
  return { rows: rows.filter((row, index) => rows.findIndex((other) => other.charges === row.charges) === index) };
}
