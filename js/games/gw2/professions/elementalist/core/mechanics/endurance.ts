import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Bind the profession's pool to shared endurance rules and its own additive trait bonuses. */
export const elementalistEndurance: EndurancePolicy<ElementalistRuntime> = {
  state: (context) => professionCoreState(context).endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (_context, vigor) => enduranceRegenerationRate(vigor)
};
