import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumber, type BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';

/** The combat resource and preview controls use the cap from the selected balance profile. */
export function maximumConduitAffinity(source: BalanceProfileSource): number {
  return Math.max(1, balanceNumber(source, TRAIT.ENIGMATIC_CONNECTION, 'maximumStacks'));
}

/** Affinity starts empty and has no passive recovery. */
export const conduitAffinityPolicy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => conduitState.from(runtime.profession).affinity,
  maximum: (runtime) => maximumConduitAffinity(runtime.helpers),
  initial: () => 0,
  recovery: () => 0
};

/** The selected Conduit module grants combat-only affinity; cap crossings can reward Expanded Consciousness Energy. */
export function gainAffinity(runtime: RevenantRuntime, amount: number): void {
  if (!runtime.engagement.combatMechanicsAllowed()) return;

  const state = conduitState.from(runtime.profession);
  const previous = runtime.resourceController.value('affinity');
  runtime.resourceController.grant('affinity', amount);
  runtime.fireTrigger(affinityGranted, { previous, maximum: state.affinity.maximum });
}

/** Capture the pre-grant pool so a cap crossing can reward Energy only once. */
export const affinityGranted = defineTriggerPoint<{
  readonly previous: number;
  readonly maximum: number;
}>('revenant.affinity-granted', [TRAIT.EXPANDED_CONSCIOUSNESS]);
