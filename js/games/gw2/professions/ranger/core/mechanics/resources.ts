import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { naturalVigorBonus } from '#gw2/professions/ranger/core/traits/wilderness-survival/attributes.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Bind the profession's pool to shared endurance rules and its own additive trait bonuses. */
export const rangerEndurance: EndurancePolicy<RangerRuntime> = {
  state: (context) => professionCoreState(context).endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (context, vigor) => enduranceRegenerationRate(vigor, naturalVigorBonus(context))
};
