const EFFECT_TYPES = new Set([
  "strike",
  "condition",
  "control",
  "blind",
  "boon",
  "buff",
  "custom",
]);

function normalizeSkillHandlers(value) {
  const entries = value instanceof Map
    ? [...value.entries()]
    : Object.entries(value || {});
  return new Map(entries.map(([id, handler]) => [String(id), handler]));
}

function normalizeStrikeTicks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Strike tick timelines require at least one hit.");
  }
  let previousAtMs = -Infinity;
  return Object.freeze(value.map((tick, index) => {
    const atMs = Number(tick?.atMs);
    const coefficient = Number(tick?.coefficient);
    if (!(atMs >= 0) || !Number.isFinite(atMs)) {
      throw new TypeError(`Strike tick ${index + 1} requires a valid atMs.`);
    }
    if (!(coefficient >= 0) || !Number.isFinite(coefficient)) {
      throw new TypeError(
        `Strike tick ${index + 1} requires a non-negative coefficient.`,
      );
    }
    if (atMs < previousAtMs) {
      throw new TypeError("Strike tick timelines must be chronological.");
    }
    previousAtMs = atMs;
    return Object.freeze({ ...tick, atMs, coefficient });
  }));
}

function normalizeConditionTicks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(
      "Condition tick timelines require at least one application.",
    );
  }
  let previousAtMs = -Infinity;
  return Object.freeze(value.map((tick, index) => {
    const atMs = Number(tick?.atMs);
    const condition = String(tick?.condition || "");
    const stacks = Number(tick?.stacks);
    const duration = Number(tick?.duration);
    if (!(atMs >= 0) || !Number.isFinite(atMs)) {
      throw new TypeError(
        `Condition application ${index + 1} requires a valid atMs.`,
      );
    }
    if (atMs < previousAtMs) {
      throw new TypeError("Condition tick timelines must be chronological.");
    }
    if (!condition) {
      throw new TypeError(
        `Condition application ${index + 1} requires a condition id.`,
      );
    }
    if (!(stacks > 0) || !Number.isFinite(stacks)) {
      throw new TypeError(
        `Condition application ${index + 1} requires positive stacks.`,
      );
    }
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new TypeError(
        `Condition application ${index + 1} requires a positive duration.`,
      );
    }
    previousAtMs = atMs;
    return Object.freeze({
      ...tick,
      atMs,
      condition,
      stacks,
      duration,
    });
  }));
}

function normalizeEffect(effect) {
  if (!effect || typeof effect !== "object" || !EFFECT_TYPES.has(effect.type)) {
    throw new TypeError(`Invalid skill effect type: ${effect?.type}`);
  }
  if (
    effect.ticks != null
    && effect.type !== "strike"
    && effect.type !== "condition"
  ) {
    throw new TypeError(
      `Effect type ${effect.type} does not support tick timelines.`,
    );
  }
  const strikeTicks = effect.type === "strike" && effect.ticks != null
    ? normalizeStrikeTicks(effect.ticks)
    : null;
  const conditionTicks = effect.type === "condition" && effect.ticks != null
    ? normalizeConditionTicks(effect.ticks)
    : null;
  if (
    strikeTicks
    && (
      effect.coefficient != null
      || effect.hits != null
      || effect.atMs != null
      || effect.atMsList != null
      || effect.atCastEndOffsetMs != null
      || effect.intervalMs != null
      || effect.flatDamage != null
      || effect.flatStrikeBase != null
      || effect.flatStrikePowerCoeff != null
    )
  ) {
    throw new TypeError(
      "Strike tick timelines cannot use aggregate coefficient or timing fields.",
    );
  }
  if (
    conditionTicks
    && (
      effect.condition != null
      || effect.stacks != null
      || effect.duration != null
      || effect.atMs != null
      || effect.atMsList != null
      || effect.atCastEndOffsetMs != null
      || effect.intervalMs != null
    )
  ) {
    throw new TypeError(
      "Condition tick timelines cannot use aggregate application or timing fields.",
    );
  }
  if (
    effect.type === "strike"
    && !strikeTicks
    && !(Number(effect.coefficient) >= 0)
    && !Number.isFinite(Number(effect.flatDamage))
    && !Number.isFinite(Number(effect.flatStrikeBase))
    && !Number.isFinite(Number(effect.flatStrikePowerCoeff))
  ) {
    throw new TypeError(
      "Strike effects require a non-negative coefficient or flat strike data.",
    );
  }
  if (effect.type === "condition") {
    if (!conditionTicks && !String(effect.condition || "")) {
      throw new TypeError("Condition effects require a condition id.");
    }
    if (
      !conditionTicks
      && (!(Number(effect.stacks) > 0) || !(Number(effect.duration) > 0))
    ) {
      throw new TypeError("Condition effects require positive stacks and duration.");
    }
  }
  if (effect.type === "boon" || effect.type === "buff") {
    if (!String(effect.boon || effect.kind || effect.name || "")) {
      throw new TypeError("Boon and buff effects require a name.");
    }
    if (!(Number(effect.duration) > 0)) {
      throw new TypeError("Boon and buff effects require a positive duration.");
    }
  }
  return Object.freeze({
    ...effect,
    ...(strikeTicks ? { ticks: strikeTicks } : {}),
    ...(conditionTicks ? { ticks: conditionTicks } : {}),
  });
}

export function createCanonicalCatalog({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  skillHandlers = {},
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  skillNameCollision = "first",
} = {}) {
  if (!["first", "last"].includes(skillNameCollision)) {
    throw new TypeError(
      `Invalid skill name collision policy: ${skillNameCollision}`,
    );
  }
  const declared = [...generated, ...extraSkills];
  const declaredIds = new Set();
  for (const skill of declared) {
    if (declaredIds.has(skill.id)) {
      throw new Error(`Duplicate skill id: ${skill.id}`);
    }
    declaredIds.add(skill.id);
  }
  const generatedById = new Map(generated.map(skill => [skill.id, skill]));
  const allIds = new Set([
    ...generatedById.keys(),
    ...Object.keys(mechanics).map(Number),
    ...Object.keys(overrides).map(Number),
    ...extraSkills.map(skill => skill.id),
  ]);
  const skills = [...allIds].map(id => {
    const skill = {
      ...(generatedById.get(id) || {}),
      ...(mechanics[id] || {}),
      ...(overrides[id] || {}),
      ...(extraSkills.find(candidate => candidate.id === id) || {}),
    };
    skill.effects = Object.freeze((skill.effects || []).map(normalizeEffect));
    skill.tags = Object.freeze([...(skill.tags || [])]);
    return Object.freeze(skill);
  });
  const skillsByName = new Map();
  for (const skill of skills) {
    if (
      skillNameCollision === "last"
      || !skillsByName.has(skill.name)
    ) {
      skillsByName.set(skill.name, skill);
    }
  }
  const catalog = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map(skill => [skill.id, skill])),
    skillsByName,
    skillHandlers: normalizeSkillHandlers(skillHandlers),
    traits: Object.freeze(traits.map(trait => Object.freeze({ ...trait }))),
    specializations: Object.freeze(
      specializations.map(specialization =>
        Object.freeze({ ...specialization })),
    ),
    weapons: new Set(weapons),
    weaponHands: new Map(
      weaponHands instanceof Map
        ? weaponHands
        : Object.entries(weaponHands || {}),
    ),
  };
  validateCanonicalCatalog(catalog);
  return Object.freeze(catalog);
}

export function validateCanonicalCatalog(catalog) {
  const validWeaponHands = new Set(["mh", "oh", "mh+oh", "2h", "-"]);
  for (const [weapon, wielding] of catalog?.weaponHands || []) {
    if (!catalog.weapons?.has(weapon)) {
      throw new Error(`Weapon hand metadata references unknown weapon ${weapon}.`);
    }
    if (!validWeaponHands.has(wielding)) {
      throw new Error(`Weapon ${weapon} has invalid wielding metadata ${wielding}.`);
    }
  }
  const ids = new Set();
  for (const skill of catalog?.skills || []) {
    if (skill.id === undefined || skill.id === null || ids.has(skill.id)) {
      throw new Error(`Duplicate or missing skill id: ${skill.id}`);
    }
    ids.add(skill.id);
    if (!String(skill.name || "")) throw new Error(`Skill ${skill.id} has no name.`);
    if (
      skill.handlerId
      && typeof catalog.skillHandlers?.get(String(skill.handlerId)) !== "function"
    ) {
      throw new Error(`Skill ${skill.id} references missing handler ${skill.handlerId}.`);
    }
    for (const reference of [skill.parentId, skill.flipParentId]) {
      if (reference != null && !catalog.skillsById.has(reference)) {
        throw new Error(`Skill ${skill.id} references missing parent ${reference}.`);
      }
    }
    if (skill.weapon && catalog.weapons.size && !catalog.weapons.has(skill.weapon)) {
      throw new Error(`Skill ${skill.id} uses invalid weapon ${skill.weapon}.`);
    }
    if (
      skill.slot != null
      && !Number.isInteger(Number(skill.slot))
      && !/^(?:Weapon_[1-5]|Profession_[1-5]|Heal|Utility|Elite|Action)$/
        .test(String(skill.slot))
    ) {
      throw new Error(`Skill ${skill.id} has invalid slot metadata.`);
    }
  }
  const traitIds = new Set();
  for (const trait of catalog?.traits || []) {
    if (trait.id === undefined || trait.id === null || traitIds.has(trait.id)) {
      throw new Error(`Duplicate or missing trait id: ${trait.id}`);
    }
    if (!String(trait.name || "")) {
      throw new Error(`Trait ${trait.id} has no name.`);
    }
    traitIds.add(trait.id);
  }
  const specializationIds = new Set();
  for (const specialization of catalog?.specializations || []) {
    if (
      specialization.id === undefined
      || specialization.id === null
      || specializationIds.has(specialization.id)
    ) {
      throw new Error(
        `Duplicate or missing specialization id: ${specialization.id}`,
      );
    }
    if (!String(specialization.name || "")) {
      throw new Error(`Specialization ${specialization.id} has no name.`);
    }
    specializationIds.add(specialization.id);
  }
  return catalog;
}
