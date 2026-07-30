import {
  eventTimelineMarkers,
  moveRotationEntry,
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

export function procFilterKey(proc) {
  return `${proc.type}:${proc.skill}`;
}

export function procFilterLabel(proc) {
  const type =
    proc.type === "relic_proc"
      ? "Relic"
      : proc.type === "skill_proc"
        ? "Skill"
        : "Trait";
  return `${proc.skill} (${type})`;
}

export function procStackLabel(proc) {
  if (proc.skill !== "Relic of Aristocracy") return "";
  return String(proc.detail || "").match(/^(\d+\/\d+)\s+stacks$/)?.[1] || "";
}

export function procBadgeLabel(procSteps = []) {
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

export function groupConsecutiveProcSteps(procSteps = []) {
  const groups = [];
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

export function timelineWeaponRows(
  rotation = [],
  { startingWeaponSet = 1, weaponSwapChangesSet = true } = {},
) {
  return timelineRows(rotation, {
    startingWeaponSet,
    isWeaponSwap(entry) {
      const item = typeof entry === "string" ? { name: entry } : entry;
      return weaponSwapChangesSet && item.name === "Swap Weapons";
    },
    isWeaponSetRefresh(entry) {
      const item = typeof entry === "string" ? { name: entry } : entry;
      return (
        (!weaponSwapChangesSet && item.name === "Swap Weapons") ||
        WEAPON_SET_REFRESH_SKILLS.has(item.name)
      );
    },
  });
}

export function continuumEndTimelineMarkers(result, rotationLength = 0) {
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
  result,
  targetHealth,
  thresholds = [],
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

export function shatterResourceSpends(result) {
  const spends = new Map();
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
