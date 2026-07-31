import { flattenProfessionState } from "../../../platform/engine/profession.js";
import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../../app/simulation/randomness.js";
import {
  REVENANT_SKILL_IDS as SKILL,
} from "../data/ids.js";
import { getActiveTraits } from "../data/traits-data.js";
import { revenantLegend, revenantLegendLoadout } from "../legend-loadout.js";
import { effectiveRevenantEnergyCost } from "./energy.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../platform/engine/types.js";
import type {
  RevenantResolverEvent,
  RevenantSkill,
  RevenantState,
  RevenantUiContext,
} from "../types.js";

export function revenantUiState(
  context: RevenantUiContext = {},
): Partial<RevenantState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

export function revenantUiSpecialization(
  context: RevenantUiContext = {},
): string {
  return context.specialization || context.config?.specialization || "Core";
}

export function activeRevenantLegend(
  context: RevenantUiContext = {},
): string {
  return (
    revenantUiState(context).activeLegendId ||
    context.build?.startingLegend ||
    ""
  );
}

function effectiveEnergyCost(
  context: RevenantUiContext,
  skill: RevenantSkill,
): number {
  return effectiveRevenantEnergyCost(
    {
      ...context,
      professionState: revenantUiState(context),
    },
    skill,
  );
}

function rotationEntryName(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "name" in entry) {
    return String(entry.name || "");
  }
  return "";
}

export function revenantTimelineSkillIcon(
  context: RevenantUiContext = {},
): string {
  if (rotationEntryName(context.entry) !== "Swap Legends") return "";
  const selected = context.build?.selectedLegends || [];
  if (selected.length !== 2) return "";
  const startingIndex = Math.max(
    0,
    selected.indexOf(context.build?.startingLegend || ""),
  );
  const priorSwaps = (context.rotation || [])
    .slice(0, Math.max(0, Number(context.index || 0)))
    .filter((entry) => rotationEntryName(entry) === "Swap Legends").length;
  const destination = selected[(startingIndex + priorSwaps + 1) % 2];
  return revenantLegend(destination || "")?.icon || "";
}

export function revenantEventLogRow(
  _context: RevenantUiContext,
  event: RevenantResolverEvent,
): ProfessionEventLogDescriptor | undefined {
  if (event?.type !== "revenant.state") return undefined;
  return {
    type: event.type,
    description:
      `${event.reason || "State"} - ` +
      `Energy ${Number(event.state?.energy || 0).toFixed(1)}`,
    className: "resource",
    order: 30,
    flags: [],
  };
}

export function revenantCorePaletteSkillAvailability(
  context: RevenantUiContext = {},
  skill: RevenantSkill,
): PaletteSkillAvailability {
  const state = revenantUiState(context);
  const activeLegend = activeRevenantLegend(context);
  if (skill.paletteLegendId === activeLegend) {
    return {
      available: false,
      message: `${skill.displayName || "Legend"} is already active`,
    };
  }
  if (
    skill.id === SKILL.UNYIELDING_IMPACT &&
    !state.availableFlips?.[SKILL.UNYIELDING_IMPACT]
  ) {
    return { available: false, message: "Cast Call to Anguish first" };
  }
  if (
    skill.id === SKILL.CALL_TO_ANGUISH &&
    state.availableFlips?.[SKILL.UNYIELDING_IMPACT]
  ) {
    return { available: false, message: "Use Unyielding Impact first" };
  }
  const upkeepActive =
    skill.handlerId === "revenant.upkeep" &&
    (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (upkeepActive) {
    return {
      available: false,
      message: "Use the release skill to end this upkeep",
    };
  }
  const energy = Number(state.energy);
  const cost = effectiveEnergyCost(context, skill);
  const onCooldown =
    Number(context.cooldowns?.[skill.name]?.remaining || 0) > 0;
  const available =
    !Number.isFinite(energy) || energy >= cost || onCooldown;
  return {
    available,
    message:
      !available && energy < cost
        ? `Requires ${cost} Energy; currently ${energy}`
        : "",
  };
}

export const revenantCoreUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    targetHealthThresholds: (context: RevenantUiContext = {}) => {
      const traits = getActiveTraits(context.build?.specializations || []);
      return traits.some((trait) => trait.name === "Swift Termination")
        ? [0.5]
        : [];
    },
    slotLoadout: revenantLegendLoadout,
    timelineSkillIcon: revenantTimelineSkillIcon,
    paletteGroups: (context: RevenantUiContext) => [{
      id: "revenant-profession",
      label: "F",
      skillIds: [SKILL.ANCIENT_ECHO],
      skillEntries: revenantLegendLoadout.view(context).bars.map((bar) => ({
        skillId: -4,
        displayName: bar.compactLabel,
        fullDisplayName: bar.label,
        icon: revenantLegend(bar.id)?.icon || "",
        paletteLegendId: bar.id,
      })),
      color: "#a84f54",
      resourceAnchor: true,
    }],
    paletteSkillAvailability: revenantCorePaletteSkillAvailability,
    resourceViews: (context: RevenantUiContext) => {
      const state = revenantUiState(context);
      return [{
        id: "energy",
        singular: "energy",
        plural: "energy",
        maximum: 100,
        value: Number(state.energy ?? context.initialEnergy ?? 50),
        startMaximum: 100,
        startValue: Number(context.initialEnergy ?? 50),
        canStart: true,
        buildKey: "initialEnergy",
        step: 1,
        displayMode: "bar",
        shortLabel: "E",
        statusLabel: "Current",
      }];
    },
    eventLogRow: revenantEventLogRow,
  });
