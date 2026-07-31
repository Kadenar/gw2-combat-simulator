/**
 * Application-facing UI dispatcher for the Necromancer family.
 *
 * Runtime UI behavior is owned by Core and the selected specialization module.
 * The family supplies the roster here so this facade can preserve the existing
 * application contract without a second specialization behavior switch.
 */
import {
  necromancerEventLogRow,
  necromancerUiSpecialization,
} from "./core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type { NecromancerUiContext } from "./types.js";

type NecromancerUiSlice = Partial<ProfessionUiContract> & SchedulerRecord;

export { necromancerEventLogRow };

export function createNecromancerFamilyUi(
  core: NecromancerUiSlice,
  specializations: Readonly<Record<string, NecromancerUiSlice>>,
): NecromancerUiSlice {
  const dispatch = (
    context: NecromancerUiContext,
  ): {
    readonly context: NecromancerUiContext;
    readonly slices: NecromancerUiSlice[];
  } => {
    const specialization = necromancerUiSpecialization(context);
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
    assumptionControls: Object.freeze([...(core.assumptionControls || [])]),
    eventLogRow: necromancerEventLogRow,
    paletteGroups: (context: NecromancerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.paletteGroups?.(active.context) || [],
      );
    },
    resourceViews: (context: NecromancerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.resourceViews?.(active.context) || [],
      );
    },
    skillBarGroups: (context: NecromancerUiContext) => {
      const active = dispatch(context);
      return active.slices.flatMap(
        (slice) => slice.skillBarGroups?.(active.context) || [],
      );
    },
    targetHealthThresholds: (context: NecromancerUiContext) => {
      const active = dispatch(context);
      return [
        ...new Set(
          active.slices.flatMap(
            (slice) => slice.targetHealthThresholds?.(active.context) || [],
          ),
        ),
      ];
    },
    paletteSkillAvailability: (
      context: NecromancerUiContext,
      skill: Skill,
    ): PaletteSkillAvailability => {
      const active = dispatch(context);
      for (const slice of active.slices) {
        const result = slice.paletteSkillAvailability?.(active.context, skill);
        if (result?.available === false) return result;
      }
      return { available: true, message: "" };
    },
  });
}
