import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';
import { adrenalImplantEnduranceBonus } from '#gw2/professions/engineer/core/traits/tools/toolbelt.js';

/** Bind the profession's pool to shared endurance rules and its own additive trait bonuses. */
export const engineerEndurance: EndurancePolicy<EngineerRuntime> = {
  state: (context) => professionCoreState(context).endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (context, vigor) => enduranceRegenerationRate(vigor, adrenalImplantEnduranceBonus(context))
};
