/** Build modifier-preview requests from selected runtime calculations and scenario assumptions. */
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/types.js';
import type { BuildAttributes, BuildContextProfession, ProfessionModifier } from '#gw2/build-context/types.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2CanonicalBuild, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import { BOON, BOON_NAMES, CONDITION } from '#gw2/platform/constants.js';
import { FOOD_DATA } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_STRIKE_DAMAGE_BONUSES } from '#gw2/platform/equipment/consumables/utilities.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Enumerates equipped effects and active assumptions for one-at-a-time removal comparisons. */
function modifierCandidates(build: Gw2CanonicalBuild, attributes: BuildAttributes): ProfessionModifier[] {
  const candidates: ProfessionModifier[] = [];
  const assumptions = build.assumptions as ProfessionBuildAssumptions;

  if (Number(assumptions.might) > 0) {
    candidates.push({
      id: 'Boon:might',
      type: 'Boon',
      boonId: BOON.MIGHT,
      label: BOON_NAMES[BOON.MIGHT]
    });
  }

  if (assumptions.fury) {
    candidates.push({
      id: 'Boon:fury',
      type: 'Boon',
      boonId: BOON.FURY,
      label: BOON_NAMES[BOON.FURY]
    });
  }

  if (assumptions.resolution) {
    candidates.push({
      id: 'Boon:resolution',
      type: 'Boon',
      boonId: BOON.RESOLUTION,
      label: BOON_NAMES[BOON.RESOLUTION]
    });
  }

  if (Number(assumptions.targetConditions?.Vulnerability) > 0) {
    candidates.push({
      id: 'Target:Vulnerability',
      type: 'Target',
      name: CONDITION.VULNERABILITY,
      label: CONDITION.VULNERABILITY
    });
  }

  for (const name of new Set((build.weaponSigils || []).flat())) {
    if (!name) continue;

    candidates.push({
      id: `Sigil:${name}`,
      type: 'Sigil',
      name,
      label: `Sigil of ${name}`
    });
  }

  if (build.relic) {
    candidates.push({
      id: `Relic:${build.relic}`,
      type: 'Relic',
      name: build.relic,
      label: `Relic of ${build.relic}`
    });
  }

  if (FOOD_DATA[build.food]?.proc) {
    candidates.push({
      id: `Food:${build.food}`,
      type: 'Food',
      name: build.food,
      label: `Food: ${FOOD_DATA[build.food].proc.name}`
    });
  }

  // Damage-only utilities need removal comparisons even though they add no attributes.
  if (UTILITY_STRIKE_DAMAGE_BONUSES[build.utility]) {
    candidates.push({
      id: `Utility:${build.utility}`,
      type: 'Utility',
      name: build.utility,
      label: build.utility
    });
  }

  for (const trait of attributes.activeTraits) {
    candidates.push({
      id: `Trait:${trait.name}`,
      type: 'Trait',
      name: trait.name,
      label: trait.name
    });
  }

  return candidates;
}

/** Preserves workspace target settings so comparisons share its health thresholds and combat endpoint. */
export function createModifierContributionRequest(
  build: Gw2CanonicalBuild,
  attributes: () => BuildAttributes,
  profession: BuildContextProfession,
  comparisonConfig: (disabled?: ProfessionModifier) => Gw2Config,
  baselineDps: number
): ModifierContributionRequest {
  // Reject an unusable baseline before preparing omission configs or dispatching any worker.
  if (!Number.isFinite(baselineDps)) throw new TypeError('Modifier contributions require a finite baseline DPS.');

  const baseConfig = comparisonConfig();
  const candidates = modifierCandidates(build, attributes());
  const runtime = profession.runtimeFor(baseConfig);
  const selected = selectedSkillIdSet(baseConfig.selectedSkillIds);
  // Discover passive owners from native attribute declarations, including currently suppressed or zero-valued grants.
  const passiveIds = new Set(
    (runtime.calculations.attributeContributions?.({ config: baseConfig, time: 0, catalog: runtime.catalog }) ?? [])
      .flatMap((contribution) => contribution.attributeEffects ?? [])
      .flatMap((effect) => (effect.kind === 'flat' && effect.passiveSkillId != null ? [effect.passiveSkillId] : []))
  );
  for (const skillId of passiveIds) {
    if (!selected.has(skillId)) continue;

    const skill = runtime.catalog.skillsById.get(skillId);

    if (!skill) continue;

    candidates.push({
      id: `Skill:${skillId}`,
      type: 'Skill',
      skillId,
      name: skill.name,
      label: skill.name
    });
  }

  const comparisons = candidates.map((modifier) => ({ modifier, config: comparisonConfig(modifier) }));
  // The baseline config discovers passive owners locally; comparison execution reuses the caller's score.
  return {
    gameId: 'gw2',
    contentId: profession.id,
    rotation: build.rotation.map((command) => ({ ...command })),
    baselineDps,
    comparisons
  };
}
