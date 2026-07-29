import {
  aggregateSigilSet,
  weaponSigilsForSet,
} from "../platform/gw2/weapon-sigils.js";
import { assumptionControlsForSpecialization } from "./profession-assumptions.js";

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
  const attr = (name) => attributeData.attributes[name]?.final || 0;
  const assumptions = app.build.assumptions;
  const targetSkillActivationsPerSecond = Math.max(
    0,
    Number(assumptions.targetSkillActivationsPerSecond) || 0,
  );
  const alliedPlayerCount = Math.max(
    0,
    Math.min(4, Math.trunc(Number(assumptions.alliedPlayerCount || 0))),
  );
  const targetConditions = { ...(assumptions.targetConditions || {}) };
  if (disabled?.type === "Target" && disabled.name === "Vulnerability") {
    delete targetConditions.Vulnerability;
  }
  const sigilSets = [1, 2]
    .map((setNumber) => weaponSigilsForSet(app.build, setNumber))
    .map((names) =>
      disabled?.type === "Sigil"
        ? names.filter((name) => name !== disabled.name)
        : names,
    )
    .map(aggregateSigilSet);
  const displayedConditionDuration =
    attributeData.attributes["Condition Duration"] || {};
  const genericConditionDurationBonus = Math.max(
    0,
    Number(displayedConditionDuration.final || 0) -
      attr("Expertise") / 15 -
      Number(displayedConditionDuration.sigils || 0),
  );
  const conditionDurationBonuses = Object.fromEntries(
    ["Bleeding", "Burning", "Confusion", "Poison", "Torment"]
      .map((name) => {
        const duration = attributeData.attributes[`${name} Duration`] || {};
        const bonus = adjustConditionDurationBonus(
          name,
          Number(duration.final || 0) - Number(duration.sigils || 0),
        );
        return [name === "Poison" ? "Poisoned" : name, Math.max(0, bonus)];
      })
      .filter(([, bonus]) => bonus > 0),
  );
  const displayedBoonDuration = attributeData.attributes["Boon Duration"] || {};
  const genericBoonDurationBonus = Math.max(
    0,
    Number(displayedBoonDuration.final || 0) -
      attr("Concentration") / 15 -
      Number(displayedBoonDuration.sigils || 0),
  );
  const boonDurationBonuses = Object.fromEntries(
    ["Quickness", "Might", "Fury"]
      .map((name) => [
        name,
        Math.max(
          0,
          Number(attributeData.attributes[`${name} Duration`]?.final || 0) -
            Number(attributeData.attributes[`${name} Duration`]?.sigils || 0),
        ),
      ])
      .filter(([, bonus]) => bonus > 0),
  );
  const professionAssumptionControls =
    assumptionControlsForSpecialization(
      app.adapter?.assumptionControls || [],
      specialization,
    );

  return {
    specialization,
    selectedTraits,
    selectedTraitIds,
    selectedSkills: app.adapter?.slotLoadout
      ? app.adapter.slotLoadout
          .selectedSkillIds({
            build: app.build,
            specialization,
            professionState: app.results?.endState?.profession,
            catalog: app.profession.catalog,
          })
          .map((id) => app.skillById.get(Number(id))?.name)
          .filter(Boolean)
      : Object.values(app.build.selectedSkills),
    primaryWeapon: app.build.weapons[0],
    secondaryWeapon: app.build.weapons[1],
    weaponSet2Primary: app.build.alternateWeapons[0],
    weaponSet2Secondary: app.build.alternateWeapons[1],
    startingWeaponSet: app.build.startingWeaponSet === 2 ? 2 : 1,
    initialResource,
    playerHealthFraction: Math.max(
      0,
      Math.min(1, Number(assumptions.playerHealthPercent ?? 100) / 100),
    ),
    deterministicChoices: Object.fromEntries(
      professionAssumptionControls
        .filter((control) => control.type === "select")
        .map((control) => [control.key, assumptions[control.key]]),
    ),
    professionAssumptions: Object.fromEntries(
      professionAssumptionControls.map((control) => [
        control.key,
        assumptions[control.key] ?? control.defaultValue,
      ]),
    ),
    stats: {
      power: attr("Power"),
      precision: attr("Precision"),
      ferocity: attr("Ferocity"),
      conditionDamage: attr("Condition Damage"),
      expertise: attr("Expertise"),
      concentration: attr("Concentration"),
      boonDurationBonus: genericBoonDurationBonus,
      boonDurationBonuses,
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
      protection: assumptions.protection,
      resolution:
        disabled?.type === "Boon" && disabled.name === "Resolution"
          ? false
          : assumptions.resolution,
      regeneration: assumptions.regeneration,
      swiftness: assumptions.swiftness,
      vigor: assumptions.vigor,
      aegis: assumptions.aegis,
    },
    allies: {
      count: alliedPlayerCount,
      strikesPerSecond: 1,
    },
    target: {
      armor: app.build.targetArmor,
      health: Math.max(0, Number(app.build.targetHealth) || 0),
      // Existing professions retain the historical defiant-golem default.
      defiant: assumptions.targetDefiant ?? true,
      flanking: Boolean(assumptions.flanking),
      behind: Boolean(assumptions.behind),
      distance: Math.max(0, Number(assumptions.targetDistance ?? 130)),
      conditions: targetConditions,
      moving: assumptions.targetMoving,
      boonless: assumptions.targetBoonless,
      nearby: true,
      activatingSkills: targetSkillActivationsPerSecond > 0,
      confusionActivationsPerSecond: targetSkillActivationsPerSecond,
    },
  };
}
