/**
 * Builds timestamp-aware attributes and critical-strike calculations.
 */
export function createCombatStats({
  config,
  traits,
  timeline,
  clamp,
  staticAttributes,
  thornsStacksAt,
  thornsConditionDamage,
}) {
  const base = staticAttributes(config, traits);
  const {
    activeSigilSetAt,
    furyActiveAt,
    instrumentsAt,
    mightStacksAt,
    skillOnCooldownAt,
    timedActive,
    timedStacks,
  } = timeline;

  const statsAt = (time) => {
    const instruments = instrumentsAt(time);
    const fortissimo =
      traits.has("Fortissimo") && instruments.length
        ? 1 + instruments.length * 0.04
        : 1;
    const thornsBonus =
      config.relic === "Thorns"
        ? thornsStacksAt(time) * thornsConditionDamage
        : 0;
    const midnightExpertise =
      config.selectedSkills?.includes("Signet of Midnight")
      && skillOnCooldownAt(10234, time)
        ? 180
        : 0;
    const dominationConditionDamage =
      config.selectedSkills?.includes("Signet of Domination")
      && skillOnCooldownAt(10232, time)
        ? 180
        : 0;
    const dynamicMightBonus =
      30 * Math.max(0, mightStacksAt(time) - Number(config.boons?.might || 0));

    return {
      power: (base.power + dynamicMightBonus) * fortissimo,
      precision: base.precision * fortissimo,
      ferocity:
        (base.ferocity + timedStacks("fencer", time, 6, 10) * 15)
        * fortissimo,
      conditionDamage:
        (
          base.conditionDamage
          + thornsBonus
          + dynamicMightBonus
          - dominationConditionDamage
        ) * fortissimo,
      expertise: (base.expertise - midnightExpertise) * fortissimo,
      conditionDurationBonus: base.conditionDurationBonus,
      conditionDurationBonuses: base.conditionDurationBonuses,
    };
  };

  const critical = (event, time, runtime = null) => {
    const stats = statsAt(time);
    const illusion = event.source === "Clone" || event.source === "Phantasm";
    let chance = 0.05 + Math.max(0, stats.precision - 1000) / 2100;
    if (!illusion) {
      chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
      chance +=
        Number(activeSigilSetAt(time).criticalChanceBonus || 0) / 100;
    }
    if (!illusion && furyActiveAt(time)) chance += 0.25;
    if (
      !illusion
      && config.relic === "Mistburn"
      && mightStacksAt(time) >= 10
    ) {
      chance += 0.1;
    }
    if (
      traits.has("Flow of Time")
      && config.boons?.alacrity
      && (
        event.source === "Player"
        || event.source === "Clone"
        || event.source === "Phantasm"
      )
    ) {
      chance += 0.15;
    }
    if (!illusion && traits.has("Quiet Intensity") && furyActiveAt(time)) {
      chance += 0.15;
    }
    if (event.source === "Phantasm" && traits.has("Phantasmal Fury")) {
      chance += config.specialization === "Virtuoso" ? 0.4 : 0.25;
    }
    chance = clamp(chance, 0, 1);

    let damage = 1.5 + stats.ferocity / 1500;
    if (
      traits.has("Superiority Complex")
      && event.source !== "Phantasm"
    ) {
      const targetHealth = Number(config.target?.health || 0);
      const totalDamage =
        Number(runtime?.totals?.strike || 0)
        + Number(runtime?.totals?.condition || 0);
      const enhanced =
        Boolean(config.target?.disabled)
        || (targetHealth > 0 && totalDamage >= targetHealth * 0.5);
      damage *= enhanced ? 1.25 : 1.15;
    }
    if (
      traits.has("Danger Time")
      && (event.source === "Player" || event.source === "Clone")
      && timedActive("danger-time", time)
    ) {
      damage *= 1.05;
    }
    return { chance, damage };
  };

  return {
    statsAt,
    critical,
  };
}
