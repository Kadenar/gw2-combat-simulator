import type { Gw2SimulationResult } from "../../platform/gw2/types.js";
import {
  buildChartSeries as buildSharedChartSeries,
  chartValueAt,
} from "../../platform/ui/charts.js";
import { skillBreakdownRows as transformSkillBreakdownRows } from "../../platform/ui/result-tables.js";
import { resultSummaryMetrics as transformResultSummaryMetrics } from "../../platform/ui/result-transform.js";

const EFFECT_NAMES: Readonly<Record<string, string>> = {
  compounding: "Compounding Power",
  "phantom-pain": "Phantom Pain",
  "illusionary-membrane": "Illusionary Membrane",
  "deadly-blades": "Deadly Blades",
  "altered-chord": "Altered Chord",
  fencer: "Fencer's Finesse",
  "mirage-cloak": "Mirage Cloak",
  alacrity: "Alacrity",
  protection: "Protection",
  resolution: "Resolution",
  vigor: "Vigor",
  might: "Might",
  fury: "Fury",
  regeneration: "Regeneration",
  swiftness: "Swiftness",
  aegis: "Aegis",
  "target-vulnerability": "Vulnerability",
  "kallas-fervor": "Kalla's Fervor",
  "necromancer-soul-barbs": "Soul Barbs",
  "berserkers-power": "Berserker's Power",
};

const EFFECT_STACK_CAPS: Readonly<Record<string, number>> = {
  Might: 25,
  Vulnerability: 25,
  "Kalla's Fervor": 5,
  "Compounding Power": 5,
  "Soul Barbs": 1,
  "Berserker's Power": 4,
  // Berserk is a boolean mode re-emitted on every entry; its overlapping
  // windows would otherwise sum into a meaningless double-digit "stack" count.
  Berserk: 1,
};

export function resultSummaryMetrics(result: Gw2SimulationResult) {
  // Metric duration follows the resolver's DPS clock. This is intentionally
  // independent from the explicit marker used as timeline display zero.
  const referenceSeconds = Math.max(
    0,
    Number(result.dpsStartTime ?? result.firstHitTime ?? 0),
  );
  if (referenceSeconds <= 0) {
    return transformResultSummaryMetrics(result);
  }
  return transformResultSummaryMetrics({
    ...result,
    duration: Math.max(0, Number(result.duration || 0) - referenceSeconds),
    deathTime:
      result.deathTime == null
        ? null
        : Math.max(0, Number(result.deathTime) - referenceSeconds),
  });
}

export function resultCombatReferenceMs(
  result: Gw2SimulationResult | null | undefined,
): number {
  const marker = result?.events?.find((event) => event.type === "combat_start");
  if (!marker) return 0;
  return Number(marker.at || 0) * 1000;
}

export function formatResultTimelineTime(
  timeMs: unknown,
  result: Gw2SimulationResult | null | undefined,
  digits = 2,
): string {
  const precision = 10 ** digits;
  const seconds =
    (Number(timeMs || 0) - resultCombatReferenceMs(result)) / 1000;
  const normalized = Math.abs(seconds) < 0.5 / precision ? 0 : seconds;
  return `${normalized.toFixed(digits)}s`;
}

export function skillBreakdownRows(result: Gw2SimulationResult) {
  return transformSkillBreakdownRows(result);
}

export function effectName(kind: unknown): string {
  const key = String(kind || "");
  if (EFFECT_NAMES[key]) return EFFECT_NAMES[key];
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ");
}

export function buildChartSeries(
  result: Gw2SimulationResult,
  sampleStepMs = 250,
) {
  return buildSharedChartSeries(result, sampleStepMs, {
    effectName,
    stackCaps: EFFECT_STACK_CAPS,
  });
}

export { chartValueAt };
