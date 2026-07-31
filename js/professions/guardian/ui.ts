import {
  guardianEventLogRow as guardianCoreEventLogRow,
  guardianUiSpecialization,
} from "./core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type { GuardianResolverEvent, GuardianUiContext } from "./types.js";

type GuardianUiSlice = Partial<ProfessionUiContract> & SchedulerRecord;

const GUARDIAN_INTERNAL_EVENT_TYPES = new Set([
  "guardian.effulgent-activated",
  "guardian.effulgent-detonate",
  "guardian.righteous-instincts-tick",
  "guardian.ashes-expired",
  "guardian.firebrand-virtue-activated",
]);

export function guardianEventLogRow(
  context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  const core = guardianCoreEventLogRow(context, event);
  if (core !== undefined) return core;
  if (GUARDIAN_INTERNAL_EVENT_TYPES.has(event.type)) return null;
  const base = {
    type: event.type,
    className: "resource",
    order: 30,
    flags: [],
  };
  if (event.type === "guardian.tome-stowed") {
    return { ...base, description: "TOME STOWED" };
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
    event.type === "guardian.radiant-forge-entered" ||
    event.type === "guardian.radiant-forge-exited"
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

export function createGuardianFamilyUi(
  core: GuardianUiSlice,
  specializations: Readonly<Record<string, GuardianUiSlice>>,
): GuardianUiSlice {
  const dispatch = (context: GuardianUiContext) => {
    const specialization = guardianUiSpecialization(context);
    const active = specializations[specialization];
    if (!active && specialization !== "Core") {
      return {
        context: {
          ...context,
          specialization: "Core",
          config: {
            ...(context.config || {}),
            specialization: "Core",
          },
        },
        slices: [core],
      };
    }
    return {
      context,
      slices: active ? [core, active] : [core],
    };
  };
  return Object.freeze({
    assumptionControls: Object.freeze([...(core.assumptionControls || [])]),
    eventLogRow: guardianEventLogRow,
    paletteGroups: (context: GuardianUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.paletteGroups?.(active.context) || [],
      );
    },
    resourceViews: (context: GuardianUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.resourceViews?.(active.context) || [],
      );
    },
    skillBarGroups: (context: GuardianUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.skillBarGroups?.(active.context) || [],
      );
    },
    paletteSkillAvailability: (
      context: GuardianUiContext,
      skill: Skill,
    ): PaletteSkillAvailability => {
      for (const slice of [core, ...Object.values(specializations)]) {
        const result = slice.paletteSkillAvailability?.(context, skill);
        if (result?.available === false) return result;
      }
      return { available: true, message: "" };
    },
  });
}
