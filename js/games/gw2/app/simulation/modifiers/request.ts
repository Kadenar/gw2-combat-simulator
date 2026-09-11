import { deterministicSimulationConfig } from '#gw2/app/simulation/config.js';
import { FOOD_DATA } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_STRIKE_DAMAGE_BONUSES } from '#gw2/platform/equipment/consumables/utilities.js';
import type { ProfessionAppState, ProfessionRuntimeApi } from '#gw2/app/types.js';
import type { ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { ModifierContributionRequest, ProfessionModifier } from '#gw2/app/simulation/modifiers/types.js';

/** Enumerates equipped effects and active assumptions for one-at-a-time removal comparisons. */
function modifierCandidates(app: ProfessionAppState): ProfessionModifier[] {
  const candidates: ProfessionModifier[] = [];
  const assumptions = app.build.assumptions as ProfessionBuildAssumptions;
  if (Number(assumptions.might) > 0) {
    candidates.push({
      id: 'Boon:Might',
      type: 'Boon',
      name: 'Might',
      label: 'Might'
    });
  }

  if (assumptions.fury) {
    candidates.push({
      id: 'Boon:Fury',
      type: 'Boon',
      name: 'Fury',
      label: 'Fury'
    });
  }

  if (assumptions.resolution) {
    candidates.push({
      id: 'Boon:Resolution',
      type: 'Boon',
      name: 'Resolution',
      label: 'Resolution'
    });
  }

  if (Number(assumptions.targetConditions?.Vulnerability) > 0) {
    candidates.push({
      id: 'Target:Vulnerability',
      type: 'Target',
      name: 'Vulnerability',
      label: 'Vulnerability'
    });
  }

  for (const name of new Set((app.build.weaponSigils || []).flat())) {
    if (!name) continue;
    candidates.push({
      id: `Sigil:${name}`,
      type: 'Sigil',
      name,
      label: `Sigil of ${name}`
    });
  }

  if (app.build.relic) {
    candidates.push({
      id: `Relic:${app.build.relic}`,
      type: 'Relic',
      name: app.build.relic,
      label: `Relic of ${app.build.relic}`
    });
  }

  if (FOOD_DATA[app.build.food]?.proc) {
    candidates.push({
      id: `Food:${app.build.food}`,
      type: 'Food',
      name: app.build.food,
      label: `Food: ${FOOD_DATA[app.build.food].proc.name}`
    });
  }

  // Damage-only utilities need removal comparisons even though they add no attributes.
  if (UTILITY_STRIKE_DAMAGE_BONUSES[app.build.utility]) {
    candidates.push({
      id: `Utility:${app.build.utility}`,
      type: 'Utility',
      name: app.build.utility,
      label: app.build.utility
    });
  }

  for (const trait of app.attributeData?.activeTraits || []) {
    candidates.push({
      id: `Trait:${trait.name}`,
      type: 'Trait',
      name: trait.name,
      label: trait.name
    });
  }

  return candidates;
}

/** Applies the same deterministic and target-health policy to the baseline and every removed modifier. */
export function createModifierContributionRequest(
  app: ProfessionAppState,
  contentId: string,
  simulationConfig: ProfessionRuntimeApi['simulationConfig']
): ModifierContributionRequest {
  const comparisonConfig = (disabled: ProfessionModifier | null = null): Gw2Config => {
    const config = deterministicSimulationConfig(simulationConfig(app, disabled));
    // Eagle needs finite target health for its health-threshold behavior; other comparisons use the full rotation.
    return app.build.relic === 'Eagle' ? config : { ...config, target: { ...config.target, health: 0 } };
  };

  const baseConfig = comparisonConfig();
  const comparisons = modifierCandidates(app).map((modifier) => ({ modifier, config: comparisonConfig(modifier) }));
  return { gameId: 'gw2', contentId, rotation: app.build.rotation, baseConfig, comparisons };
}
