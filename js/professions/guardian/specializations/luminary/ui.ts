import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import { timedBuffAt } from "../../../../app/rotation/state-snapshot-view.js";
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode,
} from "../../core/ui.js";
import type { Gw2SimulationResult } from "../../../../platform/gw2/types.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
} from "../../types.js";

function luminaryEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if ([
    "guardian.effulgent-activated",
    "guardian.effulgent-detonate",
  ].includes(event.type)) return null;
  if (
    event.type !== "guardian.radiant-forge-entered"
    && event.type !== "guardian.radiant-forge-exited"
  ) return undefined;
  const entered = event.type.endsWith("-entered");
  return {
    type: event.type,
    description:
      `RADIANT FORGE ${entered ? "ENTERED" : "EXITED"}` +
      `${event.automatic ? " [automatic]" : ""}`,
    className: "resource",
    order: 30,
    flags: [],
  };
}

const VIRTUE_NAMES = Object.freeze([
  "Radiant Justice",
  "Radiant Resolve",
  "Radiant Courage",
  "Enter Radiant Forge",
]);

function professionState(
  context: GuardianUiContext,
): Partial<GuardianState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

function luminaryStateSnapshot(
  context: GuardianUiContext,
): RotationStateSnapshotItem[] {
  const result = context.result as Gw2SimulationResult | null | undefined;
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  // Radiant Armaments only grants +7% strike damage while the radiant hammer
  // (Dazzling Hammer) is the equipped armament; other radiant weapons still
  // emit the buff but strip the bonus, so mirror the modifier's hammer gate.
  const radiant = timedBuffAt(result, "guardian-radiant-armaments", at);
  if (radiant && radiant.event.radiantWeapon === "hammer") {
    items.push({
      id: "luminary-radiant-armaments",
      label: "Radiant Armaments",
      value: formatSecondsRemaining(radiant.remaining),
      title: "Dazzling Hammer: +7% strike damage",
    });
  }
  const piercing = timedBuffAt(result, "guardian-piercing-stance", at);
  if (piercing) {
    items.push({
      id: "luminary-piercing-stance",
      label: "Piercing Stance",
      value: formatSecondsRemaining(piercing.remaining),
      title: "Piercing Stance: +10% strike damage",
    });
  }
  const daring = timedBuffAt(result, "guardian-daring-advance", at);
  if (daring) {
    items.push({
      id: "luminary-daring-advance",
      label: "Daring Advance",
      value: formatSecondsRemaining(daring.remaining),
      title: "Daring Advance: +15% strike damage",
    });
  }
  return items;
}

export const luminaryUi = Object.freeze({
  eventLogRow: luminaryEventLogRow,
  rotationStateSnapshot: luminaryStateSnapshot,
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: "guardian-f-keys",
      label: "F Keys",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
    },
    {
      id: "guardian-radiant-forge",
      label: "Radiant Forge",
      skillIds: guardianUiSkillsByMode("radiantForgeSkill"),
      color: "#d6b85c",
    },
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: "profession",
      label: "F",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      resourceAnchor: true,
      stackId: "luminary-profession",
    },
    {
      id: "radiant-forge",
      label: "RF",
      skillIds: guardianUiSkillsByMode("radiantForgeSkill"),
      color: "#d6b85c",
      stackId: "luminary-profession",
    },
  ],
  paletteSkillAvailability: (
    context: GuardianUiContext,
    skill: GuardianSkill,
  ): PaletteSkillAvailability => {
    const state = professionState(context);
    if (skill.type === "Weapon" && state.radiantForge) {
      return {
        available: false,
        message: "Weapon skills are unavailable during Radiant Forge",
      };
    }
    if (skill.radiantForgeSkill && !state.radiantForge) {
      return {
        available: false,
        message: "Enter Radiant Forge to use this skill",
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
  },
});
