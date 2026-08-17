import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from "../../../app/simulation/randomness.js";
import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import { getActiveTraits } from "../data/traits-data.js";
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  NecromancerSimulationEvent,
  NecromancerSkill,
  NecromancerState,
  NecromancerUiContext,
} from "../types.js";

let necromancerCatalog: Readonly<CanonicalCatalog>;

const LICH_SKILLS: readonly SkillId[] = Object.freeze([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const SHROUD_ENTRY_IDS = new Set<SkillId>([
  ID.DEATH_SHROUD,
  ID.REAPERS_SHROUD,
  ID.HARBINGER_SHROUD,
  ID.RITUALISTS_SHROUD,
]);
const SHROUD_EXIT_IDS = new Set<SkillId>([
  ID.END_DEATH_SHROUD,
  ID.EXIT_REAPERS_SHROUD,
  ID.EXIT_HARBINGER_SHROUD,
  ID.EXIT_RITUALISTS_SHROUD,
]);
const SHROUD_EXIT_ID_BY_SHROUD: Readonly<Record<string, SkillId>> =
  Object.freeze({
    death: ID.END_DEATH_SHROUD,
    reaper: ID.EXIT_REAPERS_SHROUD,
    harbinger: ID.EXIT_HARBINGER_SHROUD,
    ritualist: ID.EXIT_RITUALISTS_SHROUD,
  });
const SHROUD_BY_EXIT_ID: Readonly<Record<SkillId, string>> = Object.freeze({
  [ID.END_DEATH_SHROUD]: "death",
  [ID.EXIT_REAPERS_SHROUD]: "reaper",
  [ID.EXIT_HARBINGER_SHROUD]: "harbinger",
  [ID.EXIT_RITUALISTS_SHROUD]: "ritualist",
});
const SHROUD_SKILL_BAR_IDS: Readonly<Record<string, readonly SkillId[]>> =
  Object.freeze({
    death: Object.freeze([
      ID.LIFE_BLAST,
      ID.DARK_PATH,
      ID.DOOM,
      ID.LIFE_TRANSFER,
      ID.TAINTED_SHACKLES,
    ]),
    reaper: Object.freeze([
      ID.LIFE_REND,
      ID.DEATHS_CHARGE,
      ID.INFUSING_TERROR,
      ID.SOUL_SPIRAL,
      ID.EXECUTIONERS_SCYTHE,
    ]),
    harbinger: Object.freeze([
      ID.TAINTED_BOLTS,
      ID.DARK_BARRAGE,
      ID.DEVOURING_CUT,
      ID.VORACIOUS_ARC,
      ID.VITAL_DRAW,
    ]),
    ritualist: Object.freeze([
      ID.ESSENCE_BLAST,
      ID.ANGUISH,
      ID.WANDERLUST,
      ID.PRESERVATION,
      ID.SUMMON_SPIRITS,
    ]),
  });
const SHROUD_SKILL_BAR_LABELS: Readonly<Record<string, string>> = Object.freeze(
  {
    death: "Death Shroud",
    reaper: "Reaper's Shroud",
    harbinger: "Harbinger Shroud",
    ritualist: "Ritualist's Shroud",
  },
);
const HALF_HEALTH_TRAITS = new Set([
  "Siphoned Power",
  "Spiteful Fortitude",
  "Chill of Death",
  "Close to Death",
]);

export function necromancerUiState(
  context: NecromancerUiContext = {},
): Partial<NecromancerState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

export function necromancerUiSpecialization(
  context: NecromancerUiContext = {},
): string {
  return context.specialization || context.config?.specialization || "Core";
}

function shroudSkillIds(shroud: string): SkillId[] {
  return necromancerCatalog.skills
    .filter(
      (skill) =>
        skill.shroud === shroud &&
        skill.implemented &&
        !skill.simulatorExcluded,
    )
    .sort((left, right) => {
      const slotOrder =
        Number(left.shroudSlot || 0) - Number(right.shroudSlot || 0);
      if (slotOrder) return slotOrder;
      if (left.flipParentId === right.id) return 1;
      if (right.flipParentId === left.id) return -1;
      return Number(left.id) - Number(right.id);
    })
    .map((skill) => skill.id);
}

export function necromancerTransformSkillBarGroups(
  context: NecromancerUiContext,
  {
    entryId,
    shroud,
    professionSkillIds = [],
  }: {
    readonly entryId?: SkillId;
    readonly shroud?: string;
    readonly professionSkillIds?: readonly SkillId[];
  },
): ProfessionSkillBarGroup[] {
  const exitId = SHROUD_EXIT_ID_BY_SHROUD[String(shroud || "")];
  const groups: ProfessionSkillBarGroup[] = [
    {
      id: "necromancer-f-keys",
      label: "F Keys",
      skillIds: [
        ...new Set([
          ...(entryId == null ? [] : [entryId]),
          ...(exitId == null ? [] : [exitId]),
          ...professionSkillIds,
        ]),
      ],
      color: "#57a86b",
      className: "necromancer-shroud-f-keys",
      layout: "necromancer-shroud",
    },
  ];
  const shroudName = String(shroud || "");
  const shroudSkills = SHROUD_SKILL_BAR_IDS[shroudName] || [];
  if (shroudSkills.length) {
    groups.push({
      id: `necromancer-${shroudName}-shroud`,
      label: SHROUD_SKILL_BAR_LABELS[shroudName] || "Shroud",
      skillIds: [...shroudSkills],
      color: "#4d9560",
      className: "necromancer-shroud-skills",
      layout: "necromancer-shroud",
    });
  }
  return groups;
}

export function necromancerTransformPaletteGroups(
  context: NecromancerUiContext,
  {
    entryId,
    shroud,
    professionSkillIds = [],
    stackId = "",
  }: {
    readonly entryId?: SkillId;
    readonly shroud?: string;
    readonly professionSkillIds?: readonly SkillId[];
    readonly stackId?: string;
  },
): ProfessionPaletteGroup[] {
  const state = necromancerUiState(context);
  const exitId = SHROUD_EXIT_ID_BY_SHROUD[String(shroud || "")];
  const groups: ProfessionPaletteGroup[] = [
    {
      id: "profession",
      label: "F",
      skillIds: [
        ...(entryId == null ? [] : [entryId]),
        ...(exitId == null ? [] : [exitId]),
        ...professionSkillIds,
      ],
      color: "#57a86b",
      className: "compact-resource-palette necromancer-f-skills",
      resourceAnchor: true,
      stackId,
    },
  ];
  const shroudSkills = shroud ? shroudSkillIds(shroud) : [];
  if (shroudSkills.length) {
    groups.push({
      id: "shroud",
      label: "Sh",
      skillIds: [...new Set(shroudSkills)],
      color: "#4d9560",
      stackId,
    });
  }
  if (state.activeShroud === "lich") {
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
}

function necromancerCorePaletteAvailability(
  context: NecromancerUiContext = {},
  skill: NecromancerSkill,
): PaletteSkillAvailability {
  const state = necromancerUiState(context);
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
    return { available: false, message: "Requires Lingering Curse" };
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
  if ((SHROUD_ENTRY_IDS.has(skill.id) || skill.id === ID.LICH_FORM) && active) {
    return {
      available: false,
      message: "Exit the current transform first",
    };
  }
  if (SHROUD_EXIT_IDS.has(skill.id)) {
    const requiredShroud = SHROUD_BY_EXIT_ID[skill.id];
    const available = active === requiredShroud;
    return {
      available,
      message: available
        ? ""
        : `Enter ${SHROUD_SKILL_BAR_LABELS[requiredShroud] || "Shroud"} first`,
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
  // Revive has no modeled target state, and summon attacks are replaced by
  // their materialized events, so neither needs a separate log row.
  if (
    ["necromancer.revive", "necromancer.summon-attack"].includes(event?.type)
  ) {
    return null;
  }
  if (event?.type !== "necromancer.state") return undefined;
  const state = event.state || {};
  const details = [`Life force ${Number(state.lifeForce || 0).toFixed(1)}`];
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

export function necromancerCoreTargetHealthThresholds(
  context: NecromancerUiContext = {},
): number[] {
  const build = context.build || {};
  const traits = getActiveTraits(build.specializations || []);
  const hasHalfHealthTrait = traits.some((trait) =>
    HALF_HEALTH_TRAITS.has(trait.name),
  );
  const weapons = [...(build.weapons || []), ...(build.alternateWeapons || [])];
  const hasThresholdWeapon = weapons.some(
    (weapon) => weapon === "Greatsword" || weapon === "Spear",
  );
  return hasHalfHealthTrait || hasThresholdWeapon ? [0.5] : [];
}

export function necromancerSoulShardResourceViews(
  context: NecromancerUiContext,
): ProfessionResourceView[] {
  const state = necromancerUiState(context);
  const equippedWeapons = [
    ...(context.build?.weapons || []),
    ...(context.build?.alternateWeapons || []),
    context.config?.primaryWeapon,
    context.config?.weaponSet2Primary,
  ];
  return equippedWeapons.includes("Spear") || Number(state.soulShards || 0) > 0
    ? [
        {
          id: "soul-shards",
          singular: "soul shard",
          plural: "soul shards",
          maximum: 6,
          value: Number(state.soulShards || 0),
          canStart: false,
          step: 1,
          displayMode: "counter",
          pipStyle: "necromancer-soul-shards",
          shortLabel: "Soul",
          statusLabel: "Current",
          showValue: false,
        },
      ]
    : [];
}

function necromancerCoreResourceViews(
  context: NecromancerUiContext,
): ProfessionResourceView[] {
  const state = necromancerUiState(context);
  const normalizedMaximum = Math.max(
    100,
    Number(state.maximumLifeForce || 100),
  );
  const maximum = Math.round(
    Math.max(
      1,
      Number(
        state.lifeForcePoolCapacity ||
          context.lifeForcePoolCapacity ||
          normalizedMaximum,
      ),
    ),
  );
  const normalizedValue = Number(
    state.lifeForce ??
      state.resource ??
      context.value ??
      context.initialResource ??
      100,
  );
  const views: ProfessionResourceView[] = [
    {
      id: "life-force",
      singular: "life force",
      plural: "life force",
      maximum,
      value: (normalizedValue / normalizedMaximum) * maximum,
      startMaximum: 100,
      startValue: Number(context.initialResource ?? 100),
      canStart: true,
      buildKey: "initialResource",
      step: 1,
      displayMode: "bar",
      pipStyle: "compact-profession-resource-necromancer-life-force",
      shortLabel: "LF",
      statusLabel: "Current",
    },
  ];
  if (necromancerUiSpecialization(context) !== "Harbinger") {
    views.push(...necromancerSoulShardResourceViews(context));
  }
  return views;
}

export const necromancerCoreUi: Partial<ProfessionUiContract> &
  SchedulerRecord = Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  eventLogRow: necromancerEventLogRow,
  targetHealthThresholds: necromancerCoreTargetHealthThresholds,
  paletteGroups: (context: NecromancerUiContext) =>
    necromancerUiSpecialization(context) === "Core"
      ? necromancerTransformPaletteGroups(context, {
          entryId: ID.DEATH_SHROUD,
          shroud: "death",
          stackId: "core-profession",
        })
      : [],
  skillBarGroups: (context: NecromancerUiContext) =>
    necromancerUiSpecialization(context) === "Core"
      ? necromancerTransformSkillBarGroups(context, {
          entryId: ID.DEATH_SHROUD,
          shroud: "death",
        })
      : [],
  resourceViews: necromancerCoreResourceViews,
  paletteSkillAvailability: necromancerCorePaletteAvailability,
});

export function bindNecromancerCoreUi(
  catalog: Readonly<CanonicalCatalog>,
): typeof necromancerCoreUi {
  necromancerCatalog = catalog;
  return necromancerCoreUi;
}
