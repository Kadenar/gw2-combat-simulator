import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../app/simulation/randomness.js";
import { guardianCatalog } from "./catalog.js";
import {
  GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION,
} from "./mechanics/specific/virtues.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
} from "./types.js";

/**
 * Guardian adapter for the shared simulator UI.
 *
 * This module presents virtues, Firebrand tomes, and Luminary Radiant Forge
 * without implementing their combat behavior. It supplies contextual skill
 * groups, exposes tome pages, and explains why skills are unavailable while
 * a tome or Radiant Forge is active.
 */

/** @param {GuardianUiContext} context */
function guardianProfessionSkillIds(
  context: GuardianUiContext = {},
): SkillId[] {
  const specialization =
    context.specialization
    || context.config?.specialization
    || "Core";
  const names = [
    ...(GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION[specialization] || []),
    ...(specialization === "Firebrand" ? ["Stow Tome"] : []),
    ...(specialization === "Luminary"
      ? ["Enter Radiant Forge"]
      : []),
  ];
  const skillIds = names.flatMap(name => {
    const id = guardianCatalog.skillsByName.get(name)?.id;
    return id == null ? [] : [id];
  });
  const activeFlips = context.state?.profession?.availableFlips
    || context.professionState?.availableFlips
    || {};
  return skillIds.flatMap(id => {
    const skill = guardianCatalog.skillsById.get(id);
    const flipId = skill?.flipSkillId;
    const flip = flipId == null
      ? undefined
      : guardianCatalog.skillsById.get(flipId);
    return (
      flipId != null
      && flip?.flipParentId === id
      && Number(activeFlips[flipId] || 0) > 0
    ) ? [id, flipId] : [id];
  });
}

/**
 * @param {keyof GuardianSkill} property
 * @param {unknown} [value]
 */
function skillsByMode(
  property: keyof GuardianSkill,
  value: unknown = true,
): SkillId[] {
  return guardianCatalog.skills
    .filter(skill => skill[property] === value)
    .sort((left, right) =>
      String(left.slot).localeCompare(String(right.slot))
      || left.name.localeCompare(right.name))
    .map(skill => skill.id);
}

/**
 * @param {GuardianUiContext} context
 * @returns {Partial<GuardianState>}
 */
function professionState(
  context: GuardianUiContext = {},
): Partial<GuardianState> {
  return context.state?.profession
    || context.professionState
    || {};
}

/**
 * @param {GuardianUiContext} context
 * @param {GuardianSkill} skill
 */
function guardianPaletteSkillAvailability(
  context: GuardianUiContext = {},
  skill: GuardianSkill,
): PaletteSkillAvailability {
  const state = professionState(context);
  if (skill.type === "Weapon" && state.activeTome) {
    return {
      available: false,
      message: "Weapon skills are unavailable while a tome is equipped",
    };
  }
  if (skill.type === "Weapon" && state.radiantForge) {
    return {
      available: false,
      message: "Weapon skills are unavailable during Radiant Forge",
    };
  }
  if (skill.tome && !state.activeTome) {
    return {
      available: false,
      message: "Equip this tome to use its chapter skills",
    };
  }
  if (skill.tome && state.activeTome !== skill.tome) {
    return {
      available: false,
      message: `Currently using the ${state.activeTome} tome`,
    };
  }
  const pageCost = Number(skill.pageCost || 1);
  if (skill.tome && Number(state.tomePages || 0) < pageCost) {
    return {
      available: false,
      message: `Requires ${pageCost} tome pages`,
    };
  }
  if (skill.radiantForgeSkill && !state.radiantForge) {
    return {
      available: false,
      message: "Enter Radiant Forge to use this skill",
    };
  }
  if (skill.name === "Stow Tome" && !state.activeTome) {
    return {
      available: false,
      message: "No tome is currently equipped",
    };
  }
  if (skill.name === "Enter Radiant Forge" && state.radiantForge) {
    return {
      available: false,
      message: "Radiant Forge is already active",
    };
  }
  if (skill.name === "Exit Radiant Forge" && !state.radiantForge) {
    return {
      available: false,
      message: "Radiant Forge is not active",
    };
  }
  return { available: true, message: "" };
}

const GUARDIAN_INTERNAL_EVENT_TYPES = new Set([
  "guardian.effulgent-activated",
  "guardian.effulgent-detonate",
  "guardian.righteous-instincts-tick",
]);

/**
 * @param {SchedulerRecord} _context
 * @param {GuardianResolverEvent} event
 * @returns {ProfessionEventLogDescriptor | null | undefined}
 */
export function guardianEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if (GUARDIAN_INTERNAL_EVENT_TYPES.has(event.type)) {
    // These events materialize trait or skill packets. Proc, damage, control,
    // and buff rows already present their user-visible results.
    return null;
  }
  const base = {
    type: event.type,
    className: "resource",
    order: 30,
    flags: [],
  };
  if (event.type === "guardian.virtue-activated") {
    return {
      ...base,
      description:
        `VIRTUE ACTIVATED ${event.skillName || event.virtue || "Unknown"}`,
    };
  }
  if (event.type === "guardian.virtues-refreshed") {
    return {
      ...base,
      description: "VIRTUES REFRESHED",
    };
  }
  if (event.type === "guardian.tome-stowed") {
    return {
      ...base,
      description: "TOME STOWED",
    };
  }
  if (event.type === "guardian.tome-page-used") {
    const cost = Math.max(1, Number(event.pageCost || 1));
    return {
      ...base,
      description:
        `TOME PAGE USED ${event.skillName || event.tome || "Unknown"} ` +
        `(-${cost}) -> ${Number(event.pagesRemaining || 0)} remaining`,
    };
  }
  if (
    event.type === "guardian.radiant-forge-entered"
    || event.type === "guardian.radiant-forge-exited"
  ) {
    const entered = event.type.endsWith("-entered");
    return {
      ...base,
      description:
        `RADIANT FORGE ${entered ? "ENTERED" : "EXITED"}` +
        `${event.automatic ? " [automatic]" : ""}`,
    };
  }
  return undefined;
}

export const guardianUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  paletteGroups: (context: GuardianUiContext) => {
    const specialization =
      context.specialization
      || context.config?.specialization
      || "Core";
    const groups: ProfessionPaletteGroup[] = [{
      id: "profession",
      label: "F",
      skillIds: guardianProfessionSkillIds(context),
      color: "#2f7eb8",
      resourceAnchor: true,
      stackId: specialization === "Luminary"
        ? "luminary-profession"
        : "",
    }];
    if (specialization === "Firebrand") {
      groups.push(
        {
          id: "tome-justice",
          label: "F1",
          skillIds: skillsByMode("tome", "justice"),
          color: "#d26b46",
        },
        {
          id: "tome-resolve",
          label: "F2",
          skillIds: skillsByMode("tome", "resolve"),
          color: "#5dad7d",
        },
        {
          id: "tome-courage",
          label: "F3",
          skillIds: skillsByMode("tome", "courage"),
          color: "#6d96ce",
        },
      );
    }
    if (specialization === "Luminary") {
      groups.push({
        id: "radiant-forge",
        label: "RF",
        skillIds: skillsByMode("radiantForgeSkill"),
        color: "#d6b85c",
        stackId: "luminary-profession",
      });
    }
    return groups;
  },
  paletteSkillAvailability: guardianPaletteSkillAvailability,
  eventLogRow: guardianEventLogRow,
  resourceViews: (context: GuardianUiContext) => {
    const specialization =
      context.specialization
      || context.config?.specialization
      || "Core";
    if (specialization !== "Firebrand") return [];
    const state =
      context.state?.profession
      || context.professionState
      || {};
    const maximum = Number(state.maximumTomePages || 5);
    return [{
      id: "pages",
      singular: "page",
      plural: "pages",
      maximum,
      value: Number(state.tomePages ?? maximum),
      canStart: false,
      shortLabel: "Pgs",
      statusLabel: "Current",
    }];
  },
});
