import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../app/simulation/randomness.js";
import { revenantCatalog } from "./catalog.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
} from "./data/ids.js";
import { revenantLegend, revenantLegendLoadout } from "./legend-loadout.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "./legend-rules.js";
import { getActiveTraits } from "./data/traits-data.js";
import { effectiveRevenantEnergyCost } from "./mechanics/specific/energy.js";
import { isBandTogetherReady } from "./mechanics/specific/assassin-renegade.js";
import { REVENANT_HANDLER_MECHANICS } from "./mechanics/handler-mechanics.js";
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
  RevenantResolverEvent,
  RevenantSkill,
  RevenantState,
  RevenantUiContext,
} from "./types.js";

/**
 * Revenant adapter for the shared simulator UI.
 *
 * This module exposes the legend-based slot loadout, profession and legend
 * swap actions, contextual facet and Alliance skills, Energy and Affinity
 * resources, disabled-state explanations, and Revenant state-log rows. The
 * underlying legend and combat behavior is implemented elsewhere.
 */

function stateFrom(
  context: RevenantUiContext = {},
): Partial<RevenantState> {
  return context.state?.profession || context.professionState || {};
}
function specializationFrom(context: RevenantUiContext = {}): string {
  return context.specialization || context.config?.specialization || "Core";
}
function activeLegendFrom(context: RevenantUiContext = {}): string {
  return (
    stateFrom(context).activeLegendId || context.build?.startingLegend || ""
  );
}
function effectiveEnergyCost(
  context: RevenantUiContext,
  skill: RevenantSkill,
): number {
  return effectiveRevenantEnergyCost(
    {
      ...context,
      professionState: stateFrom(context),
    },
    skill,
  );
}
function hasEnoughEnergy(
  context: RevenantUiContext,
  skill: RevenantSkill,
): boolean {
  const energy = Number(stateFrom(context).energy);
  return (
    !Number.isFinite(energy) || energy >= effectiveEnergyCost(context, skill)
  );
}
function isOnCooldown(
  context: RevenantUiContext,
  skill: RevenantSkill,
): boolean {
  return Number(context.cooldowns?.[skill.name]?.remaining || 0) > 0;
}
function upkeepIsActive(
  context: RevenantUiContext,
  skill: RevenantSkill,
): boolean {
  return (
    skill.handlerId === "revenant.upkeep" &&
    (stateFrom(context).activeUpkeeps || []).some(
      (upkeep) => upkeep.skillId === skill.id,
    )
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
const PROFESSION_NAMES: Readonly<Record<string, readonly string[]>> =
Object.freeze({
  Core: ["Ancient Echo"],
  Herald: ["Facet of Nature"],
  Renegade: ["Heroic Command", "Citadel Bombardment", "Orders from Above"],
  Vindicator: ["Alliance Tactics", "Energy Meld"],
  Conduit: ["Cosmic Wisdom"],
});
const KURZICK = [
  "Selfless Spirit",
  "Battle Dance",
  "Tree Song",
  "Awakening",
  "Urn of Saint Viktor",
];

function ids(names: readonly string[]): SkillId[] {
  return [
    ...new Set<SkillId>(
      names
        .map((name) => revenantCatalog.skillsByName.get(name)?.id)
        .filter((skillId): skillId is SkillId => skillId != null),
    ),
  ];
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

export function revenantPaletteSkillIsInstant(
  context: RevenantUiContext = {},
  skill: RevenantSkill,
): boolean {
  return (
    skill?.handlerId === "revenant.band-together" &&
    isBandTogetherReady(stateFrom(context), Number(context.time || 0))
  );
}

function revenantPaletteSkillAvailability(
  context: RevenantUiContext = {},
  skill: RevenantSkill,
): PaletteSkillAvailability {
  const state = stateFrom(context);
  if (skill.paletteLegendId === activeLegendFrom(context)) {
    return {
      available: false,
      message: `${skill.displayName || "Legend"} is already active`,
    };
  }
  if (
    skill.id === SKILL.UNYIELDING_IMPACT
    && !state.availableFlips?.[SKILL.UNYIELDING_IMPACT]
  ) {
    return { available: false, message: "Cast Call to Anguish first" };
  }
  if (
    skill.id === SKILL.CALL_TO_ANGUISH
    && state.availableFlips?.[SKILL.UNYIELDING_IMPACT]
  ) {
    return { available: false, message: "Use Unyielding Impact first" };
  }
  if (upkeepIsActive(context, skill)) {
    const releaseName = skill.flipSkillId
      ? revenantCatalog.skillsById.get(skill.flipSkillId)?.name
        || "the release skill"
      : "the release skill";
    return {
      available: false,
      message: `Use ${releaseName} to end this upkeep`,
    };
  }
  // A queued cast can recover Energy while its existing cooldown elapses.
  // Keep it clickable so the scheduler can advance to that ready time.
  const available = hasEnoughEnergy(context, skill) || isOnCooldown(
    context,
    skill,
  );
  const cost = effectiveEnergyCost(context, skill);
  const energy = Number(state.energy);
  return {
    available,
    message:
      !available && Number.isFinite(energy) && energy < cost
        ? `Requires ${cost} Energy; currently ${energy}`
        : "",
  };
}

export const revenantUi: Partial<ProfessionUiContract> & SchedulerRecord =
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
  paletteGroups: (context: RevenantUiContext) => {
    const state = stateFrom(context);
    const spec = specializationFrom(context);
    const legendBars = revenantLegendLoadout.view(context).bars;
    const professionNames = [
      ...(PROFESSION_NAMES[spec] || PROFESSION_NAMES.Core),
    ];
    if (spec === "Conduit") {
      const releasePotential =
        REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeLegendFrom(context)];
      if (releasePotential) professionNames.unshift(releasePotential);
    }
    const trueNatureByLegend =
      REVENANT_HANDLER_MECHANICS.upkeep.trueNatureConsumeByLegendId as Readonly<
        Record<string, SkillId>
      >;
    const trueNatureId = trueNatureByLegend[activeLegendFrom(context)];
    const groups: ProfessionPaletteGroup[] = [
      {
        id: "revenant-profession",
        label: "F",
        skillIds: ids(professionNames).map((skillId) =>
          skillId === SKILL.FACET_OF_NATURE &&
          trueNatureId != null
          && state.availableFlips?.[trueNatureId]
            ? trueNatureId
            : skillId,
        ),
        skillEntries: legendBars.map((bar) => ({
          skillId: -4,
          displayName: bar.compactLabel,
          fullDisplayName: bar.label,
          icon: revenantLegend(bar.id)?.icon || "",
          paletteLegendId: bar.id,
        })),
        color: "#a84f54",
        resourceAnchor: true,
      },
    ];
    if (
      state.activeLegendId === LEGEND.ALLIANCE &&
      state.allianceSide === "kurzick"
    ) {
      groups.push({
        id: "revenant-alliance-kurzick",
        label: "Kurz",
        skillIds: ids(KURZICK),
        color: "#7696c7",
      });
    }
    return groups;
  },
  isPaletteSkillInstant: revenantPaletteSkillIsInstant,
  paletteSkillAvailability: revenantPaletteSkillAvailability,
  resourceViews: (context: RevenantUiContext) => {
    const state = stateFrom(context);
    const specialization = specializationFrom(context);
    const views: ProfessionResourceView[] = [
      {
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
      },
    ];
    if (specialization === "Vindicator") {
      views.push({
        id: "endurance",
        singular: "endurance",
        plural: "endurance",
        maximum: Number(state.maximumEndurance || 100),
        value: Number(state.endurance ?? 100),
        canStart: false,
        step: 1,
        displayMode: "bar",
        pipStyle: "endurance",
        shortLabel: "End",
        statusLabel: "Current",
      });
    }
    if (specialization === "Conduit") {
      views.push({
        id: "affinity",
        singular: "affinity",
        plural: "affinity",
        maximum: 5,
        value: Number(state.affinity || 0),
        canStart: false,
        step: 1,
        displayMode: "bar",
        shortLabel: "Aff",
        statusLabel: "Current",
      });
    }
    return views;
  },
  eventLogRow: revenantEventLogRow,
});
