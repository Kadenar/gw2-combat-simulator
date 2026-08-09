import type {
  LegacyRotationItem,
  SchedulerRecord,
} from "../../platform/engine/types.js";
import type {
  Gw2ProcStep,
  Gw2SimulationResult,
} from "../../platform/gw2/types.js";
import {
  eventTimelineMarkers,
  moveRotationEntry,
  rotationEntryName,
  timelineRows,
} from "../../platform/ui/timeline.js";
import { targetHealthBreakpointSnapshots } from "../../platform/ui/result-transform.js";

const WEAPON_SET_REFRESH_SKILLS = new Set([
  "Swap Legends",
  "Reaper's Shroud",
  "Exit Reaper's Shroud",
  "Harbinger Shroud",
  "Exit Harbinger Shroud",
  "Ritualist's Shroud",
  "Exit Ritualist's Shroud",
  "Enter Shadow Shroud",
  "Exit Shadow Shroud",
  "Enter Radiant Forge",
  "Exit Radiant Forge",
]);

export function procFilterKey(proc: Gw2ProcStep): string {
  return `${proc.type}:${proc.skill}`;
}

export function procFilterLabel(proc: Gw2ProcStep): string {
  const type =
    proc.type === "relic_proc"
      ? "Relic"
      : proc.type === "sigil_proc"
        ? "Sigil"
        : proc.type === "skill_proc"
          ? "Skill"
          : "Trait";
  return `${proc.skill} (${type})`;
}

export interface ProcTimelineMarker extends Gw2ProcStep {
  readonly insertionIndex: number;
  readonly activations: readonly Gw2ProcStep[];
}

function matchingProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  procType: string,
  rotationLength = 0,
): ProcTimelineMarker[] {
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  const procGroups = groupConsecutiveProcSteps(
    [...(result?.procSteps || [])].sort(
      (left, right) => left.start - right.start,
    ),
  );
  return procGroups
    .filter((group) => group.steps[0]?.type === procType)
    .map((group) => {
      const proc = group.steps[0] as Gw2ProcStep;
      // A proc at cast start belongs after that cast. Later procs are placed
      // immediately before the next command that has not started yet.
      const next = steps.find((step) => step.start > proc.start);
      return {
        ...proc,
        insertionIndex: next?.ri ?? rotationLength,
        activations: group.steps,
      };
    })
    .sort((left, right) => left.start - right.start);
}

export function sigilProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0,
): ProcTimelineMarker[] {
  return matchingProcTimelineMarkers(result, "sigil_proc", rotationLength);
}

export function relicProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0,
): ProcTimelineMarker[] {
  return matchingProcTimelineMarkers(result, "relic_proc", rotationLength);
}

export function rotationSkillHighlightKey(
  entry: LegacyRotationItem | SchedulerRecord,
): string {
  return `skill:${rotationEntryName(entry)}`;
}

export function procStackLabel(proc: Gw2ProcStep): string {
  if (proc.skill !== "Relic of Aristocracy") return "";
  return String(proc.detail || "").match(/^(\d+\/\d+)\s+stacks$/)?.[1] || "";
}

export function procBadgeLabel(procSteps: readonly Gw2ProcStep[] = []): string {
  const reductions = procSteps.map((proc) => Number(proc.cooldownReduction));
  if (
    reductions.length &&
    reductions.every((reduction) => Number.isFinite(reduction) && reduction > 0)
  ) {
    const total = reductions.reduce((sum, reduction) => sum + reduction, 0);
    const rounded = Math.round((total + Number.EPSILON) * 1000) / 1000;
    return `-${rounded}s`;
  }
  return procSteps.length > 1 ? `×${procSteps.length}` : "";
}

export interface ConsecutiveProcGroup {
  readonly key: string;
  readonly steps: Gw2ProcStep[];
}

export function groupConsecutiveProcSteps(
  procSteps: readonly Gw2ProcStep[] = [],
): ConsecutiveProcGroup[] {
  const groups: ConsecutiveProcGroup[] = [];
  for (const proc of procSteps) {
    const key = procFilterKey(proc);
    const previous = groups.at(-1);
    if (previous?.key === key) {
      previous.steps.push(proc);
    } else {
      groups.push({ key, steps: [proc] });
    }
  }
  return groups;
}

export interface TimelineWeaponRowOptions {
  readonly startingWeaponSet?: number;
  readonly weaponSwapChangesSet?: boolean;
  readonly weaponLineTransition?: (
    entry: LegacyRotationItem,
    current: { weaponSet: number; weaponLine: string | null },
  ) => string | null | undefined;
}

export function timelineWeaponRows(
  rotation: readonly LegacyRotationItem[] = [],
  {
    startingWeaponSet = 1,
    weaponSwapChangesSet = true,
    weaponLineTransition = () => undefined,
  }: TimelineWeaponRowOptions = {},
) {
  return timelineRows(rotation, {
    startingWeaponSet,
    isWeaponSwap(entry) {
      return (
        weaponSwapChangesSet && rotationEntryName(entry) === "Swap Weapons"
      );
    },
    isWeaponSetRefresh(entry) {
      const name = rotationEntryName(entry);
      return (
        (!weaponSwapChangesSet && name === "Swap Weapons") ||
        WEAPON_SET_REFRESH_SKILLS.has(name)
      );
    },
    weaponLineTransition(entry, current) {
      return weaponLineTransition(entry as LegacyRotationItem, current);
    },
  });
}

export function continuumEndTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0,
) {
  return eventTimelineMarkers(
    result,
    rotationLength,
    (event) =>
      event.type === "marker" &&
      event.name === "Continuum Shift" &&
      event.detail === "split expired",
  );
}

export function targetHealthTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  targetHealth: number,
  thresholds: readonly number[] = [],
  rotationLength = 0,
) {
  const percents = [...new Set(thresholds)]
    .map((threshold) => Number(threshold) * 100)
    .filter((percent) => percent > 0 && percent < 100);
  if (!percents.length) return [];
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return targetHealthBreakpointSnapshots(result, targetHealth, percents).map(
    (snapshot) => {
      const start = Math.round(snapshot.at * 1000);
      const next = steps.find((step) => step.start >= start);
      return {
        insertionIndex: next?.ri ?? rotationLength,
        healthPercent: snapshot.healthPercent,
        start,
        damage: snapshot.damage,
      };
    },
  );
}

export interface ShatterResourceSpend {
  readonly count: number;
  readonly resource: string;
  readonly sourceSkill: string;
}

export function shatterResourceSpends(
  result: Gw2SimulationResult | null | undefined,
): Map<number, ShatterResourceSpend> {
  const spends = new Map<number, ShatterResourceSpend>();
  for (const event of result?.events || []) {
    const rotationIndex = Number(event.rotationIndex);
    if (
      event.type !== "resource" ||
      event.reason !== "profession mechanic" ||
      !Number.isInteger(rotationIndex)
    ) {
      continue;
    }
    spends.set(rotationIndex, {
      count: Math.abs(Number(event.amount || 0)),
      resource: String(event.resource || "resources"),
      sourceSkill: String(event.sourceSkill || ""),
    });
  }
  return spends;
}

export { moveRotationEntry };
