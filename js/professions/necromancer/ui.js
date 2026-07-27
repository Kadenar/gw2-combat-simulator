import { necromancerCatalog } from "./catalog.js";
import { NECROMANCER_SKILL_IDS as ID } from "./data/ids.js";
import { getActiveTraits } from "./data/traits-data.js";

const ENTRY_ID_BY_SPECIALIZATION = Object.freeze({
  Core: ID.DEATH_SHROUD,
  Reaper: ID.REAPERS_SHROUD,
  Harbinger: ID.HARBINGER_SHROUD,
  Ritualist: ID.RITUALISTS_SHROUD,
});
const SCOURGE_SKILLS = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD,
]);
const LICH_SKILLS = Object.freeze([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const INNERVATE_BY_SPIRIT = Object.freeze({
  anguish: ID.INNERVATE_ANGUISH,
  wanderlust: ID.INNERVATE_WANDERLUST,
  preservation: ID.INNERVATE_PRESERVATION,
});

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}

function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}

function shroudForSpecialization(specialization) {
  return String(specialization || "Core").toLowerCase() === "core"
    ? "death"
    : String(specialization).toLowerCase();
}

function shroudSkillIds(context = {}) {
  const specialization = specializationFrom(context);
  if (specialization === "Scourge") return [];
  const shroud = shroudForSpecialization(specialization);
  const skills = necromancerCatalog.skills
    .filter(
      (skill) =>
        skill.shroud === shroud &&
        skill.implemented &&
        !skill.simulatorExcluded,
    )
    .sort(
      (left, right) =>
        Number(left.shroudSlot || 0) - Number(right.shroudSlot || 0) ||
        left.id - right.id,
    )
    .map((skill) => skill.id);
  const innervates =
    shroud === "ritualist"
      ? Object.values(INNERVATE_BY_SPIRIT)
      : [];
  return [...new Set([...skills, ...innervates])];
}

function professionSkillIds(context = {}) {
  const state = stateFrom(context);
  const specialization = specializationFrom(context);
  if (specialization === "Scourge") return [...SCOURGE_SKILLS];
  const entry =
    ENTRY_ID_BY_SPECIALIZATION[specialization] || ID.DEATH_SHROUD;
  const exit = Object.entries(state.availableFlips || {})
    .filter(([, expiresAt]) => Number(expiresAt) > 0)
    .map(([id]) => Number(id))
    .filter((id) =>
      [
        ID.END_DEATH_SHROUD,
        ID.EXIT_REAPERS_SHROUD,
        ID.EXIT_HARBINGER_SHROUD,
        ID.EXIT_RITUALISTS_SHROUD,
      ].includes(id),
    );
  return [entry, ...exit];
}

function rotationSkillAvailability(skill, context = {}) {
  const state = stateFrom(context);
  const active = String(state.activeShroud || "");
  const selectedTraits = new Set(
    getActiveTraits(context.build?.specializations || []).map(
      (trait) => trait.name,
    ),
  );
  if (
    skill.id === ID.DEVOURING_DARKNESS &&
    !selectedTraits.has("Lingering Curse")
  ) {
    return {
      available: false,
      message: "Requires Lingering Curse",
    };
  }
  if (
    skill.id === ID.FEAST_OF_CORRUPTION &&
    selectedTraits.has("Lingering Curse")
  ) {
    return {
      available: false,
      message: "Replaced by Devouring Darkness",
    };
  }
  if (
    skill.id === ID.SANDSTORM_SHROUD &&
    !selectedTraits.has("Herald of Sorrow")
  ) {
    return {
      available: false,
      message: "Requires Herald of Sorrow",
    };
  }
  if (skill.id === ID.DESERT_SHROUD && selectedTraits.has("Herald of Sorrow")) {
    return {
      available: false,
      message: "Replaced by Sandstorm Shroud",
    };
  }
  if (active === "lich") {
    const available = LICH_SKILLS.includes(skill.id);
    return {
      available,
      message: available ? "" : "Unavailable while Lich Form is active",
    };
  }
  if (Object.values(INNERVATE_BY_SPIRIT).includes(skill.id)) {
    const spirit = Object.entries(INNERVATE_BY_SPIRIT)
      .find(([, id]) => id === skill.id)?.[0];
    const available =
      active === "ritualist" &&
      Boolean(state.activeSpirits?.[spirit]);
    return {
      available,
      message: available
        ? ""
        : `Requires the active ${spirit || "matching"} spirit in Ritualist Shroud`,
    };
  }
  if (skill.shroud) {
    const available = active === skill.shroud;
    return {
      available,
      message: available
        ? ""
        : `Enter ${skill.specialization || "Death"} Shroud first`,
    };
  }
  if (skill.type === "Weapon" && active) {
    return {
      available: false,
      message: "Weapon skills are unavailable while shrouded",
    };
  }
  if (
    active &&
    ["Heal", "Utility", "Elite"].includes(skill.type)
  ) {
    return {
      available: false,
      message: "Slot skills are unavailable while shrouded",
    };
  }
  if (
    [
      ID.DEATH_SHROUD,
      ID.REAPERS_SHROUD,
      ID.HARBINGER_SHROUD,
      ID.RITUALISTS_SHROUD,
      ID.LICH_FORM,
    ].includes(skill.id) &&
    active
  ) {
    return {
      available: false,
      message: "Exit the current transform first",
    };
  }
  return { available: true, message: "" };
}

export const necromancerUi = Object.freeze({
  paletteGroups: (context) => {
    const groups = [{
      id: "profession",
      label: "F",
      skillIds: professionSkillIds(context),
      color: "#57a86b",
    }];
    const shroudSkills = shroudSkillIds(context);
    if (shroudSkills.length) {
      groups.push({
        id: "shroud",
        label: "Sh",
        skillIds: shroudSkills,
        color: "#4d9560",
      });
    }
    if (stateFrom(context).activeShroud === "lich") {
      groups.push({
        id: "lich",
        label: "Lch",
        skillIds: [...LICH_SKILLS],
        color: "#78b886",
      });
    }
    groups.push({
      id: "necromancer-actions",
      label: "Act",
      skillIds: [ID.SWAP_WEAPONS],
      color: "#7fbd8b",
    });
    return groups;
  },
  resourceViews: (context) => {
    const state = stateFrom(context);
    const specialization = specializationFrom(context);
    const maximum = Math.max(
      100,
      Number(state.maximumLifeForce || context.maximumLifeForce || 100),
    );
    const views = [
      {
        id: "life-force",
        singular: "life force",
        plural: "life force",
        maximum,
        value: Number(
          state.lifeForce ??
            state.resource ??
            context.value ??
            context.initialResource ??
            100,
        ),
        canStart: true,
        buildKey: "initialResource",
        step: 1,
        displayMode: "bar",
        shortLabel: "LF",
        statusLabel: "Current",
      },
    ];
    if (specialization === "Harbinger") {
      views.push({
        id: "blight",
        singular: "blight",
        plural: "blight",
        maximum: 25,
        value: Number(state.blight ?? context.initialBlight ?? 0),
        canStart: true,
        buildKey: "initialBlight",
        step: 1,
        displayMode: "bar",
        shortLabel: "Blt",
        statusLabel: "Current",
      });
    }
    const equippedWeapons = [
      ...(context.build?.weapons || []),
      ...(context.build?.alternateWeapons || []),
      context.config?.primaryWeapon,
      context.config?.weaponSet2Primary,
    ];
    if (
      equippedWeapons.includes("Spear")
      || Number(state.soulShards || 0) > 0
    ) {
      views.push({
        id: "soul-shards",
        singular: "soul shard",
        plural: "soul shards",
        maximum: 6,
        value: Number(state.soulShards || 0),
        canStart: false,
        step: 1,
        displayMode: "bar",
        shortLabel: "Shrd",
        statusLabel: "Current",
      });
    }
    return views;
  },
  rotationSkillAvailability,
  isPaletteSkillAvailable(context, skill) {
    return rotationSkillAvailability(skill, context).available;
  },
  paletteSkillUnavailableMessage(context, skill) {
    return rotationSkillAvailability(skill, context).message;
  },
});
