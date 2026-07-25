const EPSILON = 0.0001;

function hasTrait(context, name) {
  return context.traits?.has(name)
    || context.config?.selectedTraits?.includes(name);
}

function illusionSource(context) {
  return (
    context.event?.source === "Clone"
    || context.event?.source === "Phantasm"
  );
}

function timedStacks(context, kind, duration, maximum) {
  return context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0;
}

function timedActive(context, kind) {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function instrumentsAt(context) {
  return (context.events || []).filter(event =>
    event.type === "mesmer.instrument"
    && event.at <= context.time + EPSILON
    && event.expiresAt > context.time);
}

function thornsStacksAt(time) {
  if (time < 3 - EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + EPSILON) / 5) + 1);
}

export function applyMesmerAttributes(context, attributes) {
  const instruments = instrumentsAt(context);
  const fortissimo =
    hasTrait(context, "Fortissimo") && instruments.length
      ? 1 + instruments.length * 0.04
      : 1;
  const thorns =
    context.config.relic === "Thorns"
      ? thornsStacksAt(context.time) * 30
      : 0;
  const midnight =
    context.config.selectedSkills?.includes("Signet of Midnight")
    && context.timeline?.skillOnCooldownAt(10234, context.time)
      ? 180
      : 0;
  const domination =
    context.config.selectedSkills?.includes("Signet of Domination")
    && context.timeline?.skillOnCooldownAt(10232, context.time)
      ? 180
      : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0) * fortissimo,
    precision: Number(attributes.precision || 0) * fortissimo,
    ferocity:
      (Number(attributes.ferocity || 0)
        + timedStacks(context, "fencer", 6, 10) * 15)
      * fortissimo,
    conditionDamage:
      (Number(attributes.conditionDamage || 0) + thorns - domination)
      * fortissimo,
    expertise: (Number(attributes.expertise || 0) - midnight) * fortissimo,
  };
}

export function applyMesmerCriticalChance(context, initialValue) {
  const event = context.event || {};
  const illusion = illusionSource(context);
  let value = Number(initialValue || 0);
  if (illusion) {
    value -= Number(context.config.stats?.criticalChanceBonus || 0) / 100;
    value -= Number(
      context.timeline?.activeSigilSetAt(context.time)
        ?.criticalChanceBonus || 0,
    ) / 100;
    if (context.timeline?.furyActiveAt(context.time)) value -= 0.25;
  } else if (
    context.config.relic === "Mistburn"
    && context.timeline?.mightStacksAt(context.time) >= 10
  ) {
    value += 0.1;
  }
  if (
    hasTrait(context, "Flow of Time")
    && context.config.boons?.alacrity
    && ["Player", "Clone", "Phantasm"].includes(event.source)
  ) value += 0.15;
  if (
    !illusion
    && hasTrait(context, "Quiet Intensity")
    && context.timeline?.furyActiveAt(context.time)
  ) value += 0.15;
  if (event.source === "Phantasm" && hasTrait(context, "Phantasmal Fury")) {
    value += context.config.specialization === "Virtuoso" ? 0.4 : 0.25;
  }
  return Math.max(0, Math.min(1, value));
}

export function applyMesmerCriticalDamage(context, initialValue) {
  const event = context.event || {};
  let value = Number(initialValue || 1);
  if (
    hasTrait(context, "Superiority Complex")
    && event.source !== "Phantasm"
  ) {
    const targetHealth = Number(context.config.target?.health || 0);
    const totalDamage =
      Number(context.runtime?.totals?.strike || 0)
      + Number(context.runtime?.totals?.condition || 0);
    const enhanced =
      Boolean(context.config.target?.disabled)
      || (targetHealth > 0 && totalDamage >= targetHealth * 0.5);
    value *= enhanced ? 1.25 : 1.15;
  }
  if (
    hasTrait(context, "Danger Time")
    && (event.source === "Player" || event.source === "Clone")
    && timedActive(context, "danger-time")
  ) value *= 1.05;
  return value;
}

function commonDamageMultiplier(context, condition) {
  let value = 1;
  if (
    hasTrait(context, "Nomad's Endurance")
    && context.timeline?.vigorActiveAt(context.time)
  ) value *= condition ? 1.05 : 1.1;
  value *= 1 + timedStacks(context, "compounding", 8, 5) * 0.01;
  value *=
    1
    + timedStacks(context, "phantom-pain", 10, 4)
      * (condition ? 0.05 : 0.0625);
  if (timedActive(context, "deadly-blades")) {
    value *= condition ? 1.1 : 1.05;
  }
  if (!condition && timedActive(context, "time-bomb")) value *= 1.1;
  if (condition && timedActive(context, "illusionary-membrane")) {
    value *= 1.07;
  }
  const lute = instrumentsAt(context)
    .some(event => event.instrument === "Lute");
  if (lute) {
    value *= 1.1;
    if (hasTrait(context, "Shredding")) value *= 1.15;
  }
  if (!condition && timedActive(context, "altered-chord")) value *= 1.25;
  return value;
}

export function applyMesmerStrikeDamage(context, initialValue) {
  const event = context.event || {};
  let value = Number(initialValue || 1)
    * commonDamageMultiplier(context, false);
  if (illusionSource(context)) {
    value /= Math.max(
      Number(
        context.timeline?.activeSigilSetAt(context.time)?.strike || 1,
      ),
      Number.EPSILON,
    );
  }
  const vulnerability =
    context.timeline?.vulnerabilityStacksAt(context.time) || 0;
  if (event.skillName === "Mind Stab") {
    value *= 1 + vulnerability * 0.01;
  }
  if (hasTrait(context, "Fragility") && event.source !== "Phantasm") {
    value *= 1 + vulnerability * 0.005;
  }
  if (
    hasTrait(context, "Vicious Expression")
    && context.config.target?.boonless
  ) value *= 1.15;
  if (event.source === "Phantasm") {
    if (hasTrait(context, "Empowered Illusions")) value *= 1.15;
    if (hasTrait(context, "Phantasmal Force")) {
      value *= 1 + context.timeline.mightStacksAt(context.time) * 0.01;
    }
  }
  if (event.shatter && hasTrait(context, "Mental Anguish")) {
    value *= context.config.target?.activatingSkills ? 1.25 : 1.5;
  }
  if (event.blade && hasTrait(context, "Infinite Forge")) value *= 1.07;
  if (
    hasTrait(context, "Mental Focus")
    && context.config.target?.nearby
    && event.source === "Player"
  ) value *= 1.05;
  if (
    hasTrait(context, "Egotism")
    && event.source !== "Phantasm"
    && Number(context.config.target?.health || 0) > 0
    && (
      Number(context.runtime?.totals?.strike || 0)
      + Number(context.runtime?.totals?.condition || 0)
    ) > 0
  ) value *= 1.1;
  return value * Number(event.multiplier || 1);
}

export function applyMesmerConditionDamage(context, initialValue) {
  let value = Number(initialValue || 1)
    * commonDamageMultiplier(context, true);
  if (
    context.condition === "Bleeding"
    && hasTrait(context, "Bloodsong")
  ) value *= 1.25;
  return value;
}

export function applyMesmerConditionDuration(context, initialValue) {
  return (
    context.condition === "Confusion"
    && hasTrait(context, "Malicious Sorcery")
  )
    ? Math.min(2, Number(initialValue || 1) + 0.25)
    : initialValue;
}

export const mesmerAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerAttributes,
  modifyCriticalChance: applyMesmerCriticalChance,
  modifyCriticalDamage: applyMesmerCriticalDamage,
  modifyStrikeDamage: applyMesmerStrikeDamage,
  modifyConditionDamage: applyMesmerConditionDamage,
  modifyConditionDuration: applyMesmerConditionDuration,
});
