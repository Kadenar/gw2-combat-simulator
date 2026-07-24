/**
 * Builds timestamp-aware strike, condition, and duration modifiers.
 */
export function targetHealthMultiplier(ctx) {
  if (!ctx.traits.has("Egotism")) return 1;
  const targetHealth = Number(ctx.config.target?.health || 0);
  if (!(targetHealth > 0)) return 1;
  return ctx.totals.strike + ctx.totals.condition < targetHealth * 0.5
    ? 1.1
    : 1;
}

export function createDamageModifiers({
  config,
  traits,
  timeline,
  statsAt,
  durationMultiplier,
}) {
  const {
    activeSigilSetAt,
    aristocracyStacksAt,
    instrumentsAt,
    mightStacksAt,
    timedActive,
    timedStacks,
    vigorActiveAt,
    vulnerabilityStacksAt,
  } = timeline;

  const commonMultiplier = (time, condition = false) => {
    let multiplier = 1 + vulnerabilityStacksAt(time) / 100;
    if (traits.has("Nomad's Endurance") && vigorActiveAt(time)) {
      multiplier *= condition ? 1.05 : 1.1;
    }
    multiplier *= 1 + timedStacks("compounding", time, 8, 5) * 0.01;
    multiplier *=
      1
      + timedStacks("phantom-pain", time, 10, 4)
        * (condition ? 0.05 : 0.0625);
    if (timedActive("deadly-blades", time)) {
      multiplier *= condition ? 1.1 : 1.05;
    }
    if (!condition && timedActive("time-bomb", time)) multiplier *= 1.1;
    if (condition && timedActive("illusionary-membrane", time)) {
      multiplier *= 1.07;
    }

    const lutePlaying = instrumentsAt(time).some(
      (event) => event.instrument === "Lute",
    );
    if (lutePlaying) {
      multiplier *= 1.1;
      if (traits.has("Shredding")) multiplier *= 1.15;
    }
    if (!condition && timedActive("altered-chord", time)) multiplier *= 1.25;
    return multiplier;
  };

  const strikeMultiplier = (event, time) => {
    let multiplier =
      commonMultiplier(time, false)
      * Number(config.modifiers?.strike || 1)
      * Number(activeSigilSetAt(time).strike || 1);
    if (event.skillName === "Mind Stab") {
      multiplier *= 1 + vulnerabilityStacksAt(time) * 0.01;
    }
    if (traits.has("Fragility") && event.source !== "Phantasm") {
      multiplier *= 1 + vulnerabilityStacksAt(time) * 0.005;
    }
    if (traits.has("Vicious Expression")) {
      multiplier *= 1.1;
      if (config.target?.boonless) multiplier *= 1.15;
    }
    if (event.source === "Phantasm") {
      if (traits.has("Empowered Illusions")) multiplier *= 1.15;
      if (traits.has("Phantasmal Force")) {
        multiplier *= 1 + mightStacksAt(time) * 0.01;
      }
    }
    if (event.shatter && traits.has("Mental Anguish")) {
      multiplier *= config.target?.activatingSkills ? 1.25 : 1.5;
    }
    if (event.blade && traits.has("Infinite Forge")) multiplier *= 1.07;
    if (
      traits.has("Mental Focus")
      && config.target?.nearby
      && event.source === "Player"
    ) {
      multiplier *= 1.05;
    }
    return multiplier * Number(event.multiplier || 1);
  };

  const conditionMultiplier = (name, time) => {
    let multiplier =
      commonMultiplier(time, true)
      * Number(config.modifiers?.condition || 1)
      * Number(activeSigilSetAt(time).condition || 1);
    if (name === "Bleeding" && traits.has("Bloodsong")) multiplier *= 1.25;
    return multiplier;
  };

  const conditionDurationMultiplier = (
    name,
    time,
    stats = statsAt(time),
  ) => {
    const aristocracyBonus =
      config.relic === "Aristocracy"
        ? aristocracyStacksAt(time) * 0.03
        : 0;
    const activeSigils = activeSigilSetAt(time);
    const sigilBonus =
      (
        Number(activeSigils.conditionDurationBonus || 0)
        + Number(activeSigils.conditionDurationBonuses?.[name] || 0)
      ) / 100;
    return durationMultiplier(
      name,
      stats,
      traits,
      aristocracyBonus + sigilBonus,
    );
  };

  return {
    strikeMultiplier,
    conditionMultiplier,
    conditionDurationMultiplier,
  };
}
