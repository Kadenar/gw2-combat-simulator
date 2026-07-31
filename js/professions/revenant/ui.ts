import {
  revenantCoreUi,
  revenantEventLogRow,
} from "./core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type { RevenantUiContext } from "./types.js";

type RevenantUiSlice = Partial<ProfessionUiContract> & SchedulerRecord;

export { revenantEventLogRow };

/** Builds the complete application UI while runtime ownership stays sliced. */
export function createRevenantFamilyUi(
  core: RevenantUiSlice,
  specializations: Readonly<Record<string, RevenantUiSlice>>,
): RevenantUiSlice {
  const slices = (context: RevenantUiContext): RevenantUiSlice[] => {
    const specialization =
      context.specialization || context.config?.specialization || "Core";
    const active = specializations[specialization];
    return active ? [core, active] : [core];
  };

  return Object.freeze({
    assumptionControls: Object.freeze([...(core.assumptionControls || [])]),
    eventLogRow: revenantEventLogRow,
    slotLoadout: core.slotLoadout,
    timelineSkillIcon: core.timelineSkillIcon,
    targetHealthThresholds: (context: RevenantUiContext) =>
      core.targetHealthThresholds?.(context) || [],
    paletteGroups: (context: RevenantUiContext) => {
      const groups = slices(context).flatMap(
        (slice) => slice.paletteGroups?.(context) || [],
      ) as ProfessionPaletteGroup[];
      const coreGroup = groups.find(
        (group) => group.id === "revenant-profession",
      );
      const specializationGroup = groups.find(
        (group) => group.id === "revenant-profession-specialization",
      );
      const retained = groups.filter(
        (group) =>
          group.id !== "revenant-profession" &&
          group.id !== "revenant-profession-specialization",
      );
      if (!coreGroup) return retained;
      return [
        {
          ...coreGroup,
          skillIds: specializationGroup?.skillIds || coreGroup.skillIds,
        },
        ...retained,
      ];
    },
    resourceViews: (context: RevenantUiContext) =>
      slices(context).flatMap(
        (slice) => slice.resourceViews?.(context) || [],
      ),
    isPaletteSkillInstant: (context: RevenantUiContext, skill: Skill) =>
      [core, ...Object.values(specializations)].some(
        (slice) => slice.isPaletteSkillInstant?.(context, skill),
      ),
    paletteSkillAvailability: (
      context: RevenantUiContext,
      skill: Skill,
    ): PaletteSkillAvailability => {
      for (const slice of slices(context)) {
        const result = slice.paletteSkillAvailability?.(context, skill);
        if (result?.available === false) return result;
      }
      return { available: true, message: "" };
    },
  });
}

export const revenantUi = createRevenantFamilyUi(revenantCoreUi, {});
