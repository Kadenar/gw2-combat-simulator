const EFFECT_TYPES = new Set(["strike", "condition", "control", "blind", "custom"]);

function normalizeEffect(effect) {
  if (!effect || typeof effect !== "object" || !EFFECT_TYPES.has(effect.type)) {
    throw new TypeError(`Invalid skill effect type: ${effect?.type}`);
  }
  if (effect.type === "strike" && !(Number(effect.coefficient) >= 0)) {
    throw new TypeError("Strike effects require a non-negative coefficient.");
  }
  if (effect.type === "condition") {
    if (!String(effect.condition || "")) {
      throw new TypeError("Condition effects require a condition id.");
    }
    if (!(Number(effect.stacks) > 0) || !(Number(effect.duration) > 0)) {
      throw new TypeError("Condition effects require positive stacks and duration.");
    }
  }
  return Object.freeze({ ...effect });
}

export function createCanonicalCatalog({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  handlerIds = [],
  weapons = [],
} = {}) {
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
  const catalog = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map(skill => [skill.id, skill])),
    skillsByName: new Map(skills.map(skill => [skill.name, skill])),
    handlerIds: new Set(handlerIds),
    weapons: new Set(weapons),
  };
  validateCanonicalCatalog(catalog);
  return Object.freeze(catalog);
}

export function validateCanonicalCatalog(catalog) {
  const ids = new Set();
  for (const skill of catalog?.skills || []) {
    if (skill.id === undefined || skill.id === null || ids.has(skill.id)) {
      throw new Error(`Duplicate or missing skill id: ${skill.id}`);
    }
    ids.add(skill.id);
    if (!String(skill.name || "")) throw new Error(`Skill ${skill.id} has no name.`);
    if (skill.handlerId && !catalog.handlerIds.has(skill.handlerId)) {
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
  return catalog;
}
