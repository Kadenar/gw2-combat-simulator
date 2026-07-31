/**
 * Application-facing UI dispatcher for the Engineer family. Runtime behavior
 * is owned by Core and only the selected elite module.
 */
import {
  engineerEventLogRow,
  engineerUiSpecialization,
} from "./core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type {
  EngineerUiContext,
  EngineerUiSelection,
} from "./types.js";

type EngineerUiSlice = Partial<ProfessionUiContract> & SchedulerRecord;

export {
  engineerEventLogRow,
  engineerWeaponSkillMatchesSet,
} from "./core/ui.js";

export function createEngineerFamilyUi(
  core: EngineerUiSlice,
  specializations: Readonly<Record<string, EngineerUiSlice>>,
): EngineerUiSlice {
  const dispatch = (
    context: EngineerUiContext,
  ): {
    readonly context: EngineerUiContext;
    readonly slices: EngineerUiSlice[];
  } => {
    const specialization = engineerUiSpecialization(context);
    const active = specializations[specialization];
    if (active || specialization === "Core") {
      return {
        context,
        slices: active ? [core, active] : [core],
      };
    }
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
  };

  return Object.freeze({
    assumptionControls: Object.freeze([
      ...(core.assumptionControls || []),
      ...Object.values(specializations).flatMap(
        (slice) => slice.assumptionControls || [],
      ),
    ]),
    eventLogRow: engineerEventLogRow,
    weaponSkillMatchesSet: core.weaponSkillMatchesSet,
    weaponSwapChangesSet: false,
    isSlotSkillSelectable: core.isSlotSkillSelectable,
    paletteGroups: (context: EngineerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.paletteGroups?.(active.context) || [],
      );
    },
    resourceViews: (context: EngineerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.resourceViews?.(active.context) || [],
      );
    },
    skillBarGroups: (context: EngineerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.skillBarGroups?.(active.context) || [],
      );
    },
    updateSkillBarSelection: (
      context: EngineerUiContext,
      selection: EngineerUiSelection,
    ): boolean => {
      const active = dispatch(context);
      for (const slice of [...active.slices].reverse()) {
        if (slice.updateSkillBarSelection?.(active.context, selection)) {
          return true;
        }
      }
      return false;
    },
    timelineWeaponLineTransition: (context: EngineerUiContext) => {
      const active = dispatch(context);
      for (const slice of [...active.slices].reverse()) {
        const transition =
          slice.timelineWeaponLineTransition?.(active.context);
        if (transition !== undefined) return transition;
      }
      return undefined;
    },
    paletteSkillAvailability: (
      context: EngineerUiContext,
      skill: Skill,
    ): PaletteSkillAvailability => {
      const active = dispatch(context);
      for (const slice of active.slices) {
        const result = slice.paletteSkillAvailability?.(
          active.context,
          skill,
        );
        if (result?.available === false) return result;
      }
      return { available: true, message: "" };
    },
  });
}
