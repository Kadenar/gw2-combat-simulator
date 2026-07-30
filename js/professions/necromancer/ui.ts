import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../app/simulation/randomness.js";
import { necromancerCatalog } from "./catalog.js";
import { NECROMANCER_SKILL_IDS as ID } from "./data/ids.js";
import { getActiveTraits } from "./data/traits-data.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  NecromancerSimulationEvent,
  NecromancerSkill,
  NecromancerState,
  NecromancerUiContext,
} from "./types.js";

/**
 * Necromancer adapter for the shared simulator UI.
 *
 * This module presents shroud, Scourge, Ritualist, and Lich actions; describes
 * life force, blight, and soul-shard resources; explains transformation-based
 * skill availability; and declares relevant target-health thresholds. It
 * reflects combat state but does not resolve combat mechanics.
 */

const ENTRY_ID_BY_SPECIALIZATION: Readonly<Record<string, SkillId>> =
Object.freeze({
  Core: ID.DEATH_SHROUD,
  Reaper: ID.REAPERS_SHROUD,
  Harbinger: ID.HARBINGER_SHROUD,
  Ritualist: ID.RITUALISTS_SHROUD,
});
const SCOURGE_SKILLS: readonly SkillId[] = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD,
]);
const LICH_SKILLS: readonly SkillId[] = Object.freeze([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const INNERVATE_BY_SPIRIT: Readonly<Record<string, SkillId>> = Object.freeze({
  anguish: ID.INNERVATE_ANGUISH,
  wanderlust: ID.INNERVATE_WANDERLUST,
  preservation: ID.INNERVATE_PRESERVATION,
});
const HALF_HEALTH_TRAITS = Object.freeze(new Set([
  "Siphoned Power",
  "Spiteful Fortitude",
  "Chill of Death",
  "Close to Death",
]));

function stateFrom(
  context: NecromancerUiContext = {},
): Partial<NecromancerState> {
  return context.state?.profession || context.professionState || {};
}

function specializationFrom(context: NecromancerUiContext = {}): string {
  return context.specialization || context.config?.specialization || "Core";
}

function shroudForSpecialization(specialization: string): string {
  return String(specialization || "Core").toLowerCase() === "core"
    ? "death"
    : String(specialization).toLowerCase();
}

function shroudSkillIds(context: NecromancerUiContext = {}): SkillId[] {
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
        Number(left.id) - Number(right.id),
    )
    .map((skill) => skill.id);
  return [...new Set(skills)];
}

function professionSkillIds(context: NecromancerUiContext = {}): SkillId[] {
  const state = stateFrom(context);
  const specialization = specializationFrom(context);
  if (specialization === "Scourge") return [...SCOURGE_SKILLS];
  const entry =
    ENTRY_ID_BY_SPECIALIZATION[specialization] || ID.DEATH_SHROUD;
  const exit = Object.entries(state.availableFlips || {})
    .filter(([, expiresAt]) => Number(expiresAt) > 0)
    .map(([id]) => Number(id))
    .filter((id) =>
      new Set<SkillId>([
        ID.END_DEATH_SHROUD,
        ID.EXIT_REAPERS_SHROUD,
        ID.EXIT_HARBINGER_SHROUD,
        ID.EXIT_RITUALISTS_SHROUD,
      ]).has(id),
    );
  const innervates = specialization === "Ritualist"
    ? Object.values(INNERVATE_BY_SPIRIT)
    : [];
  return [entry, ...exit, ...innervates];
}

function paletteSkillAvailability(
  context: NecromancerUiContext = {},
  skill: NecromancerSkill,
): PaletteSkillAvailability {
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
  if (
    skill.rechargeOnMinionDeath &&
    skill.flipSkillId != null &&
    Number(state.availableFlips?.[skill.flipSkillId] || 0) > 0
  ) {
    return {
      available: false,
      message: "Summoned minion is still alive",
    };
  }
  if (active === "lich") {
    const available = new Set(LICH_SKILLS).has(skill.id);
    return {
      available,
      message: available ? "" : "Unavailable while Lich Form is active",
    };
  }
  if (new Set(Object.values(INNERVATE_BY_SPIRIT)).has(skill.id)) {
    const spirit = Object.entries(INNERVATE_BY_SPIRIT)
      .find(([, id]) => id === skill.id)?.[0];
    const available = Boolean(
      spirit && state.activeSpirits?.[spirit],
    );
    return {
      available,
      message: available
        ? ""
        : `Requires the active ${spirit || "matching"} spirit`,
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
    ["Heal", "Utility", "Elite"].includes(String(skill.type || ""))
  ) {
    return {
      available: false,
      message: "Slot skills are unavailable while shrouded",
    };
  }
  if (
    new Set<SkillId>([
      ID.DEATH_SHROUD,
      ID.REAPERS_SHROUD,
      ID.HARBINGER_SHROUD,
      ID.RITUALISTS_SHROUD,
      ID.LICH_FORM,
    ]).has(skill.id) &&
    active
  ) {
    return {
      available: false,
      message: "Exit the current transform first",
    };
  }
  return { available: true, message: "" };
}

export function necromancerEventLogRow(
  _context: NecromancerUiContext,
  event: NecromancerSimulationEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if (event?.type === "necromancer.chill") {
    const duration = Math.max(0, Number(event.duration || 0));
    return {
      type: event.type,
      description:
        `CHILLED ${event.skillName || event.name || "Target"}` +
        `${duration > 0 ? ` (${duration.toFixed(1)}s)` : ""}`,
      className: "condition",
      order: 70,
      flags: [],
    };
  }
  if ([
    "necromancer.painful-bond",
    "necromancer.summon-attack",
    "necromancer.weapon-spell",
  ].includes(event?.type)) {
    // These are resolver state or packet-materialization events. Their action,
    // buff, proc, and resolved-damage rows carry the user-visible information.
    return null;
  }
  if (event?.type !== "necromancer.state") return undefined;
  const state = event.state || {};
  const details = [
    `Life force ${Number(state.lifeForce || 0).toFixed(1)}`,
  ];
  if (state.activeShroud) details.push(`Shroud ${state.activeShroud}`);
  if (Number(state.blight || 0) > 0) {
    details.push(`Blight ${Number(state.blight)}`);
  }
  if (Number(state.soulShards || 0) > 0) {
    details.push(`Soul shards ${Number(state.soulShards)}`);
  }
  return {
    type: event.type,
    description: [event.reason || "State", ...details].join(" · "),
    className: "resource",
    order: 30,
    flags: [],
  };
}

export const necromancerUi: Partial<ProfessionUiContract> & SchedulerRecord =
Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  eventLogRow: necromancerEventLogRow,
  targetHealthThresholds: (context: NecromancerUiContext = {}): number[] => {
    const specialization = specializationFrom(context);
    const build = context.build || {};
    const traits = getActiveTraits(build.specializations || []);
    const hasHalfHealthTrait = traits.some(
      (trait) => HALF_HEALTH_TRAITS.has(trait.name),
    );
    const weapons = [
      ...(build.weapons || []),
      ...(build.alternateWeapons || []),
    ];
    const hasThresholdWeapon = weapons.some(
      (weapon) => weapon === "Greatsword" || weapon === "Spear",
    );
    return (
      hasHalfHealthTrait
      || hasThresholdWeapon
      || specialization === "Reaper"
    )
      ? [0.5]
      : [];
  },
  paletteGroups: (context: NecromancerUiContext) => {
    const ritualist = specializationFrom(context) === "Ritualist";
    const groups: ProfessionPaletteGroup[] = [{
      id: "profession",
      label: "F",
      skillIds: professionSkillIds(context),
      color: "#57a86b",
      resourceAnchor: true,
      stackId: ritualist ? "ritualist-profession" : "",
    }];
    const shroudSkills = shroudSkillIds(context);
    if (shroudSkills.length) {
      groups.push({
        id: "shroud",
        label: "Sh",
        skillIds: shroudSkills,
        color: "#4d9560",
        stackId: ritualist ? "ritualist-profession" : "",
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
  resourceViews: (context: NecromancerUiContext) => {
    const state = stateFrom(context);
    const specialization = specializationFrom(context);
    const normalizedMaximum = Math.max(
      100,
      Number(state.maximumLifeForce || 100),
    );
    const maximum = Math.round(Math.max(
      1,
      Number(
        state.lifeForcePoolCapacity
        || context.lifeForcePoolCapacity
        || normalizedMaximum,
      ),
    ));
    const normalizedValue = Number(
      state.lifeForce
      ?? state.resource
      ?? context.value
      ?? context.initialResource
      ?? 100,
    );
    const views: ProfessionResourceView[] = [
      {
        id: "life-force",
        singular: "life force",
        plural: "life force",
        maximum,
        value: normalizedValue / normalizedMaximum * maximum,
        startMaximum: 100,
        startValue: Number(context.initialResource ?? 100),
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
  paletteSkillAvailability,
});
