import { enqueueOrdered } from "../../platform/engine/event-queue.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "./ids.js";
import {
  hasNecromancerTrait,
  snapshotNecromancerState,
  syncNecromancerResources,
} from "./state.js";

const SHROUD_ENTRY = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
const SHROUD_EXIT = Object.freeze({
  [ID.END_DEATH_SHROUD]: ID.DEATH_SHROUD,
  [ID.EXIT_REAPERS_SHROUD]: ID.REAPERS_SHROUD,
  [ID.EXIT_HARBINGER_SHROUD]: ID.HARBINGER_SHROUD,
  [ID.EXIT_RITUALISTS_SHROUD]: ID.RITUALISTS_SHROUD,
});
const EXIT_ID_BY_SHROUD = Object.freeze({
  death: ID.END_DEATH_SHROUD,
  reaper: ID.EXIT_REAPERS_SHROUD,
  harbinger: ID.EXIT_HARBINGER_SHROUD,
  ritualist: ID.EXIT_RITUALISTS_SHROUD,
});
const ENTRY_ID_BY_SHROUD = Object.freeze(
  Object.fromEntries(
    Object.entries(SHROUD_ENTRY).map(([skillId, shroud]) => [
      shroud,
      Number(skillId),
    ]),
  ),
);
const SHROUD_DRAIN_PER_SECOND = Object.freeze({
  death: 3,
  reaper: 4,
  harbinger: 5,
  ritualist: 3,
});

function traits(context) {
  return new Set([
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ]);
}

function hasTrait(context, traitId) {
  return hasNecromancerTrait(traits(context), traitId);
}

function targetConditionCount(config = {}) {
  return Object.values(config.target?.conditions || {})
    .filter(value => value === true || Number(value) > 0)
    .length;
}

function targetBoonCount(config = {}) {
  if (config.target?.boonless) return 0;
  if (Array.isArray(config.target?.boons)) return config.target.boons.length;
  return Math.max(0, Number(config.target?.boonCount || 1));
}

function alacrityRecharge(context, duration) {
  return duration / (context.hasBuff?.("alacrity", context.effectiveEnd) ? 1.25 : 1);
}

function emitState(context, at, reason = "") {
  context.emit({
    type: "necromancer.state",
    at,
    source: "necromancer",
    sourceId: `necromancer.state.${reason || "update"}`,
    actorType: "player",
    reason,
    state: snapshotNecromancerState(context.state.profession),
  });
}

function emitDamage(
  context,
  skill,
  coefficient,
  {
    at = context.effectiveEnd,
    hits = 1,
    interval = 0,
    name = skill.name,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    skillWeapon = skill.weapon || "",
    metadata = {},
  } = {},
) {
  const perHit = Number(coefficient || 0) / Math.max(1, hits);
  for (let index = 0; index < Math.max(1, hits); index += 1) {
    context.emit({
      type: "damage",
      at: at + index * interval,
      source,
      sourceId,
      actorType,
      skillId: skill.id,
      skillName: skill.name,
      name,
      coefficient: perHit,
      hits: 1,
      hitIndex: index + 1,
      totalHits: hits,
      skillWeapon,
      canCrit: metadata.canCrit !== false,
      ...metadata,
    });
  }
}

function emitCondition(
  context,
  skill,
  name,
  stacks,
  duration,
  {
    at = context.effectiveEnd,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    metadata = {},
  } = {},
) {
  context.emit({
    type: "condition",
    at,
    source,
    sourceId,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${name}`,
    condition: name,
    stacks,
    duration,
    ...metadata,
  });
}

function emitControl(context, skill, kind = "control", at = context.effectiveEnd) {
  context.emit({
    type: "control",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    controlKind: kind,
  });
}

function emitBuff(context, skill, kind, duration, stacks = 1) {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration,
    stacks,
  });
}

function purgeTimedState(state, at) {
  state.blightExpiries = (state.blightExpiries || [])
    .filter(expiresAt => expiresAt > at);
  state.shades = (state.shades || [])
    .filter(expiresAt => expiresAt > at);
  syncNecromancerResources(state);
}

function addBlight(state, stacks, at) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    25 - state.blightExpiries.length,
  );
  state.blightExpiries.push(
    ...Array.from({ length: count }, () => at + 25),
  );
  syncNecromancerResources(state);
  return count;
}

function consumeBlight(state, stacks, at) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.blightExpiries.length,
  );
  state.blightExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

export function gainNecromancerLifeForce(context, amount, at, reason = "") {
  if (!(Number(amount) > 0)) return 0;
  const state = context.state.profession;
  const multiplier = hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1;
  const before = state.lifeForce;
  state.lifeForce = Math.min(
    state.maximumLifeForce,
    state.lifeForce + Number(amount) * multiplier,
  );
  syncNecromancerResources(state);
  if (state.lifeForce !== before && reason) emitState(context, at, reason);
  return state.lifeForce - before;
}

function setShroudRecharge(context, shroud, at) {
  const entryId = ENTRY_ID_BY_SHROUD[shroud];
  if (entryId != null) {
    context.state.cooldowns.set(
      entryId,
      at + alacrityRecharge(context, 10),
    );
  }
}

function clearSpiritsUnlessLingering(context) {
  if (hasTrait(context, TRAIT.LINGERING_SPIRITS)) return;
  context.state.profession.activeSpirits = {};
}

function leaveShroud(context, at, reason = "shroud-exit") {
  const state = context.state.profession;
  const shroud = state.activeShroud;
  if (!shroud || shroud === "lich") return;
  state.activeShroud = "";
  state.shroudEnteredAt = 0;
  state.nextBlightAt = Number.POSITIVE_INFINITY;
  const exitId = EXIT_ID_BY_SHROUD[shroud];
  if (exitId != null) {
    delete state.availableFlips[exitId];
    delete state.availableFlips[String(exitId)];
  }
  if (shroud === "ritualist") clearSpiritsUnlessLingering(context);
  setShroudRecharge(context, shroud, at);
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.SOUL_BARBS,
      actorType: "player",
      kind: "necromancer-soul-barbs",
      duration: 15,
      stacks: 1,
    });
  }
  context.emit({
    type: "weapon_set",
    at,
    source: "necromancer",
    sourceId: `necromancer.${reason}`,
    actorType: "player",
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
  });
  emitState(context, at, reason);
}

function activeSignetOfUndeath(context) {
  return (context.config?.selectedSkills || [])
    .includes("Signet of Undeath");
}

function activeSignetOfVampirism(context) {
  return (context.config?.selectedSkills || [])
    .includes("Signet of Vampirism");
}

export function advanceNecromancerState(context, target) {
  const state = context.state.profession;
  const start = Number(state.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  purgeTimedState(state, end);

  if (activeSignetOfUndeath(context)) {
    while (state.signetNextLifeForceAt <= end + context.epsilon) {
      if (state.signetNextLifeForceAt > start + context.epsilon) {
        gainNecromancerLifeForce(
          context,
          4,
          state.signetNextLifeForceAt,
        );
      }
      state.signetNextLifeForceAt += 3;
    }
  }

  if (activeSignetOfVampirism(context)) {
    const cooldownReadyAt =
      Number(context.state.cooldowns.get(ID.SIGNET_OF_VAMPIRISM) || 0);
    const passiveWhileRecharging =
      hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)
      && Boolean(state.activeShroud);
    while (state.vampirismNextAt <= end + context.epsilon) {
      if (
        state.vampirismNextAt > start + context.epsilon
        && (
          cooldownReadyAt <= state.vampirismNextAt + context.epsilon
          || passiveWhileRecharging
        )
      ) {
        const skill =
          context.catalog.skillsById.get(ID.SIGNET_OF_VAMPIRISM);
        emitDamage(context, skill, 0, {
          at: state.vampirismNextAt,
          name: "Signet of Vampirism — Passive Life Siphon",
          skillWeapon: "Unequipped",
          metadata: {
            flatStrikeBase: 129,
            flatStrikePowerCoeff: 0.03,
            noCrit: true,
            damageKind: "life-steal",
          },
        });
      }
      state.vampirismNextAt += 3;
    }
  }

  if (
    !state.activeShroud
    && hasTrait(context, TRAIT.ETERNAL_LIFE)
  ) {
    const seconds = Math.max(0, Math.floor(end) - Math.floor(start));
    const threshold = state.maximumLifeForce * 0.66;
    state.lifeForce = Math.min(
      threshold,
      state.lifeForce + seconds * 3,
    );
  }

  if (state.activeShroud && state.activeShroud !== "lich") {
    const shroud = state.activeShroud;
    const rate = SHROUD_DRAIN_PER_SECOND[shroud] || 0;
    const elapsed = end - start;
    const potentialDrain = rate * elapsed;
    const exitAt = potentialDrain >= state.lifeForce && rate > 0
      ? start + state.lifeForce / rate
      : end;

    if (shroud === "harbinger") {
      const stacksPerSecond = hasTrait(context, TRAIT.DOOM_APPROACHES) ? 4 : 2;
      while (state.nextBlightAt <= exitAt + context.epsilon) {
        addBlight(state, stacksPerSecond, state.nextBlightAt);
        state.nextBlightAt += 1;
      }
    }
    state.lifeForce = Math.max(
      0,
      state.lifeForce - rate * (exitAt - start),
    );
    syncNecromancerResources(state);
    if (state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      leaveShroud(context, exitAt, "life-force-depleted");
    }
  } else if (
    !state.activeShroud
    && Object.keys(state.activeSpirits || {}).length
    && hasTrait(context, TRAIT.LINGERING_SPIRITS)
  ) {
    state.lifeForce = Math.max(0, state.lifeForce - 3 * (end - start));
    if (state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      state.activeSpirits = {};
    }
  }

  if (state.activeShroud === "lich" && state.lichEndsAt <= end + context.epsilon) {
    state.activeShroud = "";
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, end);
  }
  state.lastResourceAt = end;
  syncNecromancerResources(state);
  emitState(context, end, "advance");
}

function activateShroud(context, skill) {
  const state = context.state.profession;
  const shroud = SHROUD_ENTRY[skill.id];
  const at = context.effectiveEnd;
  const specialization = context.config.specialization || "Core";
  if (shroud === "harbinger") {
    gainNecromancerLifeForce(context, 15, at);
  }
  state.activeShroud = shroud;
  state.shroudEnteredAt = at;
  state.lastResourceAt = at;
  state.nextBlightAt = shroud === "harbinger"
    ? Math.floor(at) + 1
    : Number.POSITIVE_INFINITY;
  state.soulTwistingAvailable =
    shroud === "ritualist"
    && hasTrait(context, TRAIT.SOUL_TWISTING);
  const exitId = EXIT_ID_BY_SHROUD[shroud];
  state.availableFlips[exitId] = Number.POSITIVE_INFINITY;
  state.pendingShroudEntryId = skill.id;

  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitBuff(context, skill, "necromancer-soul-barbs", 15);
  }
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    emitBuff(context, skill, "might", 5, 5);
  }
  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    emitBuff(context, skill, "fury", 8);
  }
  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    emitDamage(context, skill, 1, {
      name: "Spiteful Spirit",
      source: "Trait",
      sourceId: TRAIT.SPITEFUL_SPIRIT,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
  }
  context.emit({
    type: "weapon_set",
    at,
    source: "necromancer",
    sourceId: `necromancer.${shroud}-shroud-enter`,
    actorType: "player",
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
    specialization,
  });
  emitState(context, at, "shroud-enter");
  return true;
}

function shroud(context, skill) {
  advanceNecromancerState(context, context.start);
  if (SHROUD_ENTRY[skill.id]) return activateShroud(context, skill);
  if (SHROUD_EXIT[skill.id]) {
    leaveShroud(context, context.effectiveEnd);
    return true;
  }
  return false;
}

function lich(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = "lich";
    state.lichEndsAt = at + 20;
    state.lastResourceAt = at;
    state.availableFlips[ID.EXIT_LICH_FORM] = state.lichEndsAt;
    emitState(context, at, "lich-enter");
  } else {
    state.activeShroud = "";
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, at);
    emitState(context, at, "lich-exit");
  }
  return true;
}

function signetOfVampirism(context, skill) {
  const at = context.effectiveEnd;
  for (let index = 1; index <= 6; index += 1) {
    emitDamage(context, skill, 0, {
      at: at + index,
      name: "Signet of Vampirism — Vampiric Mark",
      skillWeapon: "Unequipped",
      metadata: {
        flatStrikeBase: 163,
        flatStrikePowerCoeff: 0.05,
        noCrit: true,
        damageKind: "life-steal",
      },
    });
  }
  return true;
}

function signetOfUndeath() {
  return true;
}

function swapWeapons(context, skill) {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  return true;
}

function flip(context, skill) {
  const state = context.state.profession;
  if (skill.flipSkillId != null) {
    const duration = {
      [ID.DARK_PATH]: 3,
      [ID.INFUSING_TERROR]: 6,
      [ID.RIPPLE_OF_HORROR]: 12,
    }[skill.id] || 5;
    state.availableFlips[skill.flipSkillId] =
      context.effectiveEnd + duration;
  }
  if (skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }
  emitState(context, context.effectiveEnd, "flip");
  return false;
}

const MINIONS = Object.freeze({
  [ID.SUMMON_BLOOD_FIEND]: {
    key: "blood-fiend",
    count: 1,
    coefficient: 0.3,
    interval: 2,
    commandId: ID.TASTE_OF_DEATH,
  },
  [ID.SUMMON_BONE_FIEND]: {
    key: "bone-fiend",
    count: 1,
    coefficient: 0.4,
    interval: 2.4,
    commandId: ID.RIGOR_MORTIS,
  },
  [ID.SUMMON_BONE_MINIONS]: {
    key: "bone-minion",
    count: 2,
    coefficient: 0.2,
    interval: 1.5,
    commandId: ID.PUTRID_EXPLOSION,
  },
  [ID.SUMMON_FLESH_WURM]: {
    key: "flesh-wurm",
    count: 1,
    coefficient: 0.6,
    interval: 2.5,
    commandId: ID.NECROTIC_TRAVERSAL,
  },
  [ID.SUMMON_SHADOW_FIEND]: {
    key: "shadow-fiend",
    count: 1,
    coefficient: 0.3,
    interval: 1.8,
    commandId: ID.HAUNT,
  },
  [ID.SUMMON_FLESH_GOLEM]: {
    key: "flesh-golem",
    count: 1,
    coefficient: 0.5,
    interval: 2.2,
    commandId: ID.CHARGE,
  },
});

const COMMANDS = Object.freeze({
  [ID.RIGOR_MORTIS]: {
    minion: "bone-fiend",
    coefficient: 0.5,
    control: "immobilize",
  },
  [ID.PUTRID_EXPLOSION]: {
    minion: "bone-minion",
    coefficient: 1,
    condition: ["Poisoned", 1, 5],
    consumes: 1,
  },
  [ID.NECROTIC_TRAVERSAL]: {
    minion: "flesh-wurm",
    coefficient: 0,
    condition: ["Poisoned", 2, 9],
    consumes: 1,
  },
  [ID.TASTE_OF_DEATH]: {
    minion: "blood-fiend",
    coefficient: 0,
    consumes: 1,
  },
  [ID.HAUNT]: {
    minion: "shadow-fiend",
    coefficient: 0.4,
    control: "blind",
  },
  [ID.CHARGE]: {
    minion: "flesh-golem",
    coefficient: 1.5,
    control: "knockdown",
  },
});

function queueSummonAttacks(context, skill, definition, at) {
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  for (
    let attackAt = at + definition.interval;
    attackAt <= horizon;
    attackAt += definition.interval
  ) {
    context.emit({
      type: "necromancer.summon-attack",
      at: attackAt,
      source: "Minion",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: `${skill.name} — Minion Attack`,
      name: `${skill.name} — Minion Attack`,
      coefficient: definition.coefficient * definition.count,
      requiresMinion: definition.key,
      summonKind: "minion",
    });
  }
}

function emitCreatureSummonTraits(context, skill, at, count = 1) {
  if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    gainNecromancerLifeForce(context, 10 * count, at);
  }
  if (hasTrait(context, TRAIT.EXPLOSIVE_GROWTH)) {
    emitDamage(context, skill, 1.2 * count, {
      at,
      name: "Explosive Growth",
      source: "Trait",
      sourceId: TRAIT.EXPLOSIVE_GROWTH,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
  }
}

function summonMinion(context, skill) {
  const definition = MINIONS[skill.id];
  if (!definition) return false;
  const state = context.state.profession;
  state.activeMinions[definition.key] = definition.count;
  if (definition.commandId) {
    state.availableFlips[definition.commandId] = Number.POSITIVE_INFINITY;
  }
  emitState(context, context.effectiveEnd, "minion-summoned");
  emitCreatureSummonTraits(
    context,
    skill,
    context.effectiveEnd,
    definition.count,
  );
  queueSummonAttacks(context, skill, definition, context.effectiveEnd);
  return true;
}

function minionCommand(context, skill) {
  const definition = COMMANDS[skill.id];
  if (!definition) return false;
  if (definition.coefficient > 0) {
    emitDamage(context, skill, definition.coefficient, {
      source: "Minion",
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
  }
  if (definition.condition) {
    emitCondition(
      context,
      skill,
      definition.condition[0],
      definition.condition[1],
      definition.condition[2],
      { source: "Minion", actorType: "summon" },
    );
  }
  if (definition.control && definition.control !== "blind") {
    emitControl(context, skill, definition.control);
  }
  if (definition.control === "blind") {
    context.emit({
      type: "blind",
      at: context.effectiveEnd,
      source: "Minion",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: skill.name,
    });
  }
  if (definition.consumes) {
    const remaining = Math.max(
      0,
      Number(context.state.profession.activeMinions[definition.minion] || 0)
        - definition.consumes,
    );
    if (remaining) {
      context.state.profession.activeMinions[definition.minion] = remaining;
    } else {
      delete context.state.profession.activeMinions[definition.minion];
      delete context.state.profession.availableFlips[skill.id];
    }
  }
  emitState(context, context.effectiveEnd, "minion-command");
  return true;
}

function shade(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const maximum = hasTrait(context, TRAIT.SAND_SAVANT) ? 1 : 3;
    state.shades = [...state.shades, at + 15]
      .sort((left, right) => left - right)
      .slice(-maximum);
  } else {
    state.lifeForce = Math.max(
      0,
      state.lifeForce - Number(skill.lifeForceCost || 0),
    );
  }
  syncNecromancerResources(state);
  emitState(context, at, "shade");

  emitDamage(context, skill, 0.666, {
    name: "Sand Shade — Strike",
    sourceId: ID.MANIFEST_SAND_SHADE,
    skillWeapon: "Unequipped",
  });
  emitCondition(context, skill, "Torment", 1, 2, {
    sourceId: ID.MANIFEST_SAND_SHADE,
  });

  if (
    skill.id === ID.NEFARIOUS_FAVOR
    && hasTrait(context, TRAIT.SADISTIC_SEARING)
  ) {
    emitCondition(context, skill, "Burning", 1, 4, {
      source: "Trait",
      sourceId: TRAIT.SADISTIC_SEARING,
      actorType: "effect",
    });
  } else if (skill.id === ID.SAND_CASCADE) {
    emitBuff(context, skill, "might", 6, 2);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitDamage(context, skill, 0.333);
    emitControl(context, skill, "fear");
  } else if (skill.id === ID.DESERT_SHROUD) {
    emitDamage(context, skill, 3.15, {
      at,
      hits: 7,
      interval: 1,
    });
    for (let index = 0; index < 7; index += 1) {
      emitCondition(context, skill, "Torment", 1, 5, {
        at: at + index,
      });
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    emitDamage(context, skill, 3, { at: at + 4 });
    emitCondition(context, skill, "Torment", 6, 5, { at: at + 4 });
  }
  return true;
}

function applyCascadingCorruption(context, skill, consumed, at) {
  if (!hasTrait(context, TRAIT.CASCADING_CORRUPTION) || !consumed) return;
  const state = context.state.profession;
  state.cascadingCorruptionStacks += consumed;
  if (state.cascadingCorruptionStacks < 20) return;
  state.cascadingCorruptionStacks -= 20;
  state.meltdownUntil = at + 10;
  emitDamage(context, skill, 1, {
    at,
    name: "Cascading Corruption",
    source: "Trait",
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: "effect",
    skillWeapon: "Unequipped",
  });
}

function elixir(context, skill) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  const ambition = skill.id === ID.ELIXIR_OF_AMBITION;
  const threshold = ambition ? 10 : 5;
  const empowered = state.blight >= threshold;
  const consumed = empowered ? consumeBlight(state, threshold, at) : 0;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-consumed");
  const durationMultiplier = empowered ? 2 : 1;
  const coefficient = {
    [ID.ELIXIR_OF_PROMISE]: 0.8,
    [ID.ELIXIR_OF_RISK]: 2,
    [ID.ELIXIR_OF_BLISS]: 0.8,
    [ID.ELIXIR_OF_IGNORANCE]: 0.8,
    [ID.ELIXIR_OF_ANGUISH]: 1,
    [ID.ELIXIR_OF_AMBITION]: 1.5,
  }[skill.id] || 0;
  emitDamage(context, skill, coefficient * (empowered ? 2 : 1), {
    metadata: {
      blightEmpowered: empowered,
      necromancerBlight: state.blight,
    },
  });
  if (skill.id === ID.ELIXIR_OF_PROMISE) {
    emitCondition(
      context,
      skill,
      "Poisoned",
      3,
      5 * durationMultiplier,
    );
  } else if (skill.id === ID.ELIXIR_OF_RISK) {
    emitCondition(
      context,
      skill,
      "Torment",
      3,
      5 * durationMultiplier,
    );
    emitBuff(context, skill, "might", 10, 10);
    emitBuff(context, skill, "fury", 10);
  } else if (skill.id === ID.ELIXIR_OF_IGNORANCE) {
    context.emit({
      type: "blind",
      at,
      source: "necromancer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
    });
  } else if (skill.id === ID.ELIXIR_OF_ANGUISH) {
    emitBuff(context, skill, "quickness", 5);
  } else if (skill.id === ID.ELIXIR_OF_AMBITION) {
    for (const name of [
      "Bleeding",
      "Burning",
      "Confusion",
      "Poisoned",
      "Torment",
    ]) {
      emitCondition(
        context,
        skill,
        name,
        3,
        5 * durationMultiplier,
      );
    }
    emitBuff(context, skill, "might", 5, 25);
    emitBuff(context, skill, "fury", 5);
    emitBuff(context, skill, "quickness", 5);
    emitBuff(context, skill, "alacrity", 5);
  }
  addBlight(state, ambition ? 15 : 10, at);
  emitState(context, at, "blight-gained");
  return true;
}

function blightSkill(context, skill) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  const empowered = state.blight >= 5;
  const consumed = empowered ? consumeBlight(state, 5, at) : 0;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-skill");
  if (skill.id === ID.DEVOURING_CUT) {
    emitDamage(context, skill, empowered ? 2 : 1, {
      metadata: { blightEmpowered: empowered, necromancerBlight: state.blight },
    });
    if (empowered) emitCondition(context, skill, "Torment", 5, 5);
  } else {
    emitDamage(context, skill, empowered ? 2.8 : 1.4, {
      metadata: { blightEmpowered: empowered, necromancerBlight: state.blight },
    });
    emitControl(
      context,
      skill,
      hasTrait(context, TRAIT.DOOM_APPROACHES) ? "fear" : "daze",
    );
    if (empowered) emitCondition(context, skill, "Torment", 5, 7);
  }
  return true;
}

const SPIRITS = Object.freeze({
  [ID.ANGUISH]: {
    key: "anguish",
    attackCoefficient: 0.75,
  },
  [ID.WANDERLUST]: {
    key: "wanderlust",
    attackCoefficient: 0.6,
  },
  [ID.PRESERVATION]: {
    key: "preservation",
    attackCoefficient: 0,
  },
});

function queueSpiritAutoattacks(context, skill, spirit, at) {
  if (!(spirit.attackCoefficient > 0)) return;
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  for (let attackAt = at + 3; attackAt <= horizon; attackAt += 3) {
    context.emit({
      type: "necromancer.summon-attack",
      at: attackAt,
      source: "Spirit",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: `${skill.name} — Spirit Attack`,
      name: `${skill.name} — Spirit Attack`,
      coefficient: spirit.attackCoefficient,
      requiresSpirit: spirit.key,
      summonKind: "spirit",
    });
  }
}

function ritualist(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.ESSENCE_BLAST) {
    const spirits = Object.keys(state.activeSpirits).length;
    emitDamage(context, skill, 0.75 * (1 + spirits * 0.15), {
      metadata: { activeSpirits: spirits },
    });
    return true;
  }
  if (skill.id === ID.SUMMON_SPIRITS) {
    for (const key of Object.keys(state.activeSpirits)) {
      const coefficient = key === "anguish" ? 2 : key === "wanderlust" ? 1 : 0;
      if (coefficient > 0) {
        emitDamage(context, skill, coefficient, {
          source: "Spirit",
          sourceId: `ritualist.${key}`,
          actorType: "summon",
          metadata: { summonKind: "spirit" },
        });
      }
    }
    return true;
  }

  const spirit = SPIRITS[skill.id];
  if (!spirit) return false;
  state.activeSpirits[spirit.key] = true;
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    state.pendingSoulTwistSkill = skill.id;
  }
  emitState(context, at, "spirit-summoned");
  emitCreatureSummonTraits(context, skill, at);

  if (skill.id === ID.ANGUISH) {
    emitDamage(context, skill, 3.5, {
      hits: 7,
      interval: 0.1,
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
    for (let index = 1; index <= 10; index += 1) {
      context.emit({
        type: "damage",
        at: at + index,
        source: "Spirit",
        sourceId: "ritualist.painful-bond",
        actorType: "effect",
        skillId: skill.id,
        skillName: skill.name,
        name: "Painful Bond",
        coefficient: 0,
        flatStrikeBase: 200,
        flatStrikePowerCoeff: 0.4,
        noCrit: true,
        damageKind: "life-steal",
      });
    }
  } else if (skill.id === ID.WANDERLUST) {
    emitDamage(context, skill, 1);
    emitDamage(context, skill, 0.72, {
      hits: 4,
      interval: 1,
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
    emitControl(context, skill, "knockdown");
  }
  queueSpiritAutoattacks(context, skill, spirit, at);
  return true;
}

function innervate(context, skill) {
  const at = context.effectiveEnd;
  if (skill.id === ID.INNERVATE_ANGUISH) {
    emitDamage(context, skill, 1.3, {
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
  } else if (skill.id === ID.INNERVATE_WANDERLUST) {
    emitControl(context, skill, "fear");
  }
  gainNecromancerLifeForce(context, 10, at);
  emitState(context, at, "innervate");
  return true;
}

function summonMadness(context, skill) {
  const start = context.effectiveEnd;
  for (let index = 0; index < 8; index += 1) {
    const summonAt = start + index;
    emitCreatureSummonTraits(context, skill, summonAt);
    emitDamage(context, skill, 0.33, {
      at: summonAt + 1,
      name: "Unstable Horror — Attack",
      source: "Minion",
      sourceId: `unstable-horror.${index}`,
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
    emitDamage(context, skill, 1.25, {
      at: summonAt + 6,
      name: "Unstable Horror — Explosion",
      source: "Minion",
      sourceId: `unstable-horror.${index}`,
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
  }
  return true;
}

export function applySkillLifeForceGain(context, skill) {
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes("Mark") && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += 3;
  }
  if ([ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS].includes(skill.id)) {
    amount += Math.min(5, targetConditionCount(context.config));
  }
  if (skill.id === 10529 && targetBoonCount(context.config) === 0) {
    amount = 0;
  }
  if (amount > 0) {
    gainNecromancerLifeForce(
      context,
      amount,
      context.effectiveEnd,
      "skill-life-force",
    );
  }
}

export function finalizeNecromancerCast(context, skill) {
  advanceNecromancerState(context, context.effectiveEnd);
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  applySkillLifeForceGain(context, skill);
  const state = context.state.profession;
  if (state.pendingShroudEntryId === skill.id) {
    context.state.cooldowns.set(skill.id, Number.POSITIVE_INFINITY);
    delete state.pendingShroudEntryId;
  }
  if (state.pendingSoulTwistSkill === skill.id) {
    context.state.cooldowns.delete(skill.id);
    delete state.pendingSoulTwistSkill;
  }
  emitState(context, context.effectiveEnd, "after-cast");
}

export function handleNecromancerStateEvent(context, event) {
  const resolverOnly = {
    targetChilledUntil: context.profession.targetChilledUntil,
    dreadUntil: context.profession.dreadUntil,
    fearOfDeathReadyAt: context.profession.fearOfDeathReadyAt,
    vampiricPresenceReadyAt: context.profession.vampiricPresenceReadyAt,
    barbedPrecisionProgress: context.profession.barbedPrecisionProgress,
    demonicLoreReadyAt: context.profession.demonicLoreReadyAt,
    traitProcReadyAt: context.profession.traitProcReadyAt,
  };
  for (const key of Object.keys(context.profession)) {
    delete context.profession[key];
  }
  Object.assign(context.profession, structuredClone(event.state || {}));
  for (const [key, value] of Object.entries(resolverOnly)) {
    if (value !== undefined) context.profession[key] = value;
  }
}

export function handleNecromancerChillEvent(context, event) {
  context.profession.targetChilledUntil = Math.max(
    Number(context.profession.targetChilledUntil || 0),
    event.at + Number(event.duration || 0),
  );
  if (hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: event.at,
      name: "Deathly Chill — Bleeding",
      skillName: "Deathly Chill",
      condition: "Bleeding",
      stacks: 3,
      duration: 8,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_CHILL,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.(
      "trait",
      "Deathly Chill",
      event.at,
      event.skillName,
    );
  }
}

export function handleNecromancerSummonAttack(context, event) {
  if (
    event.requiresMinion
    && !(Number(context.profession.activeMinions?.[event.requiresMinion]) > 0)
  ) return;
  if (
    event.requiresSpirit
    && !context.profession.activeSpirits?.[event.requiresSpirit]
  ) return;
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: "summon",
    skillId: event.skillId,
    skillName: event.skillName,
    name: event.name,
    coefficient: event.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    canCrit: true,
    summonKind: event.summonKind,
  });
}

export const necromancerSkillHandlers = Object.freeze({
  "necromancer.shroud": shroud,
  "necromancer.lich": lich,
  "necromancer.weapon-swap": swapWeapons,
  "necromancer.flip": flip,
  "necromancer.minion": summonMinion,
  "necromancer.minion-command": minionCommand,
  "necromancer.shade": shade,
  "necromancer.elixir": elixir,
  "necromancer.blight-skill": blightSkill,
  "necromancer.ritualist": ritualist,
  "necromancer.innervate": innervate,
  "necromancer.summon-madness": summonMadness,
  "necromancer.signet-vampirism": signetOfVampirism,
  "necromancer.signet-undeath": signetOfUndeath,
});
