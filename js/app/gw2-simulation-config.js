import {
  aggregateSigilSet,
  weaponSigilsForSet,
} from "../platform/gw2/weapon-sigils.js";

/**
 * Assembles common equipment, boon, target, weapon, and stat simulation input.
 * Profession adapters supply specialization, traits, and resource semantics.
 */
export function createGw2SimulationConfig({
  app,
  attributeData,
  specialization,
  disabled = null,
  selectedTraits = [],
  selectedTraitIds = [],
  initialResource = 0,
  adjustConditionDurationBonus = (_name, bonus) => bonus,
} = {}) {
  const attr = name => attributeData.attributes[name]?.final || 0;
  const assumptions = app.build.assumptions;
  const targetSkillActivationsPerSecond = Math.max(
    0,
    Number(assumptions.targetSkillActivationsPerSecond) || 0,
  );
  const targetConditions = { ...(assumptions.targetConditions || {}) };
  if (disabled?.type === "Target" && disabled.name === "Vulnerability") {
    delete targetConditions.Vulnerability;
  }
  const sigilSets = [1, 2]
    .map(setNumber => weaponSigilsForSet(app.build, setNumber))
    .map(names => disabled?.type === "Sigil"
      ? names.filter(name => name !== disabled.name)
      : names)
    .map(aggregateSigilSet);
  const displayedConditionDuration =
    attributeData.attributes["Condition Duration"] || {};
  const genericConditionDurationBonus = Math.max(
    0,
    Number(displayedConditionDuration.final || 0)
      - attr("Expertise") / 15
      - Number(displayedConditionDuration.sigils || 0),
  );
  const conditionDurationBonuses = Object.fromEntries(
    ["Bleeding", "Burning", "Confusion", "Poison", "Torment"]
      .map(name => {
        const duration =
          attributeData.attributes[`${name} Duration`] || {};
        const bonus = adjustConditionDurationBonus(
          name,
          Number(duration.final || 0) - Number(duration.sigils || 0),
        );
        return [
          name === "Poison" ? "Poisoned" : name,
          Math.max(0, bonus),
        ];
      })
      .filter(([, bonus]) => bonus > 0),
  );

  return {
    specialization,
    selectedTraits,
    selectedTraitIds,
    selectedSkills: Object.values(app.build.selectedSkills),
    primaryWeapon: app.build.weapons[0],
    secondaryWeapon: app.build.weapons[1],
    weaponSet2Primary: app.build.alternateWeapons[0],
    weaponSet2Secondary: app.build.alternateWeapons[1],
    startingWeaponSet: app.build.startingWeaponSet === 2 ? 2 : 1,
    initialResource,
    stats: {
      power: attr("Power"),
      precision: attr("Precision"),
      ferocity: attr("Ferocity"),
      conditionDamage: attr("Condition Damage"),
      expertise: attr("Expertise"),
      concentration: attr("Concentration"),
      vitality: attr("Vitality"),
      criticalChanceBonus: 0,
      conditionDurationBonus: genericConditionDurationBonus,
      conditionDurationBonuses,
    },
    sigilSets,
    relic: disabled?.type === "Relic" ? "" : app.build.relic,
    food: disabled?.type === "Food" ? "" : app.build.food,
    boons: {
      might:
        disabled?.type === "Boon" && disabled.name === "Might"
          ? 0
          : assumptions.might,
      fury:
        disabled?.type === "Boon" && disabled.name === "Fury"
          ? false
          : assumptions.fury,
      quickness: assumptions.quickness,
      alacrity: assumptions.alacrity,
      regeneration: assumptions.regeneration,
      vigor: assumptions.vigor,
    },
    target: {
      armor: app.build.targetArmor,
      health: Math.max(0, Number(app.build.targetHealth) || 0),
      conditions: targetConditions,
      moving: assumptions.targetMoving,
      boonless: assumptions.targetBoonless,
      nearby: true,
      activatingSkills: targetSkillActivationsPerSecond > 0,
      confusionActivationsPerSecond: targetSkillActivationsPerSecond,
    },
  };
}
