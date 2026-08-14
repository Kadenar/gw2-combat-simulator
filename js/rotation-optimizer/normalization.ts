import type {
  LegacyRotationEntry,
  LegacyRotationItem,
  SchedulerStep,
} from "../platform/engine/types.js";
import type { Gw2Config, Gw2SimulationResult } from "../platform/gw2/types.js";
import type { RotationSimulation } from "./types.js";

const CLOCK_EPSILON_MS = 0.5;

export interface FixedWindowNormalizationOptions {
  readonly setupRotation?: readonly LegacyRotationItem[];
  readonly combatRotation?: readonly LegacyRotationItem[];
  readonly horizonMs: number;
  readonly config: Gw2Config;
  readonly simulate: RotationSimulation;
  readonly onSimulation?: () => void;
}

export interface NormalizedFixedWindowRotation {
  readonly rotation: LegacyRotationItem[];
  readonly setupRotation: LegacyRotationItem[];
  readonly combatRotation: LegacyRotationItem[];
  readonly result: Gw2SimulationResult;
  readonly combatStartTimeMs: number;
  readonly horizonEndTimeMs: number;
  readonly enteredCombatDurationMs: number;
  readonly terminalWaitMs: number;
  readonly precastActions: number;
  readonly combatActions: number;
}

export function rotationEntryName(entry: LegacyRotationItem): string | number {
  return typeof entry === "object" && entry !== null ? entry.name : entry;
}

export function isCombatStartEntry(entry: LegacyRotationItem): boolean {
  return rotationEntryName(entry) === "__combat_start";
}

export function isWaitEntry(entry: LegacyRotationItem): boolean {
  return rotationEntryName(entry) === "__wait";
}

export function splitRotationAtCombatStart(
  rotation: readonly LegacyRotationItem[],
): {
  readonly setupRotation: LegacyRotationItem[];
  readonly combatRotation: LegacyRotationItem[];
} {
  const markerIndex = rotation.findIndex(isCombatStartEntry);
  if (markerIndex < 0) {
    return {
      setupRotation: [{ name: "__combat_start" }],
      combatRotation: [...rotation],
    };
  }
  return {
    setupRotation: [...rotation.slice(0, markerIndex + 1)],
    combatRotation: [...rotation.slice(markerIndex + 1)],
  };
}

export function normalizeSetupRotation(
  setupRotation: readonly LegacyRotationItem[] | undefined,
): LegacyRotationItem[] {
  if (!setupRotation?.length) return [{ name: "__combat_start" }];
  const markerIndex = setupRotation.findIndex(isCombatStartEntry);
  if (markerIndex < 0) return [{ name: "__combat_start" }];
  return [...setupRotation.slice(0, markerIndex + 1)];
}

function withoutSetupOrTerminalWait(
  combatRotation: readonly LegacyRotationItem[] | undefined,
): LegacyRotationItem[] {
  const requested = [...(combatRotation || [])];
  const markerIndex = requested.findIndex(isCombatStartEntry);
  const combat = markerIndex < 0 ? requested : requested.slice(markerIndex + 1);
  if (combat.length && isWaitEntry(combat[combat.length - 1])) combat.pop();
  return combat;
}

function simulationDurationMs(result: Gw2SimulationResult): number {
  return Math.max(
    0,
    Number(result.endState?.time ?? Number(result.duration || 0) * 1000),
  );
}

function stepForIndex(
  result: Gw2SimulationResult,
  rotationIndex: number,
): SchedulerStep | null {
  return result.steps.find((step) => step.ri === rotationIndex) || null;
}

function terminalWait(waitMs: number): LegacyRotationEntry {
  return { name: "__wait", waitMs };
}

/**
 * Fits any complete or partial combat sequence to one fixed combat window and
 * exactly replays the resulting rotation. Baselines, finalists, and mutations
 * must all use this path.
 */
export function normalizeFixedWindowRotation({
  setupRotation: requestedSetup,
  combatRotation: requestedCombat,
  horizonMs: requestedHorizonMs,
  config,
  simulate,
  onSimulation = () => {},
}: FixedWindowNormalizationOptions): NormalizedFixedWindowRotation {
  const horizonMs = Math.max(1, Math.round(Number(requestedHorizonMs)));
  const setupRotation = normalizeSetupRotation(requestedSetup);
  const combatCandidates = withoutSetupOrTerminalWait(requestedCombat);
  const requestedRotation = [...setupRotation, ...combatCandidates];

  onSimulation();
  const requestedResult = simulate(requestedRotation, config);
  const combatStartTimeMs = Math.max(
    0,
    Number(requestedResult.combatStartTime ?? 0) * 1000,
  );
  const horizonEndTimeMs = combatStartTimeMs + horizonMs;
  const fittedCombat: LegacyRotationItem[] = [];

  for (let index = 0; index < combatCandidates.length; index += 1) {
    const rotationIndex = setupRotation.length + index;
    const step = stepForIndex(requestedResult, rotationIndex);
    const startMs = Number(step?.actualStart ?? step?.start ?? 0);
    const endMs = Number(step?.end ?? startMs);
    if (
      !step ||
      step.invalid ||
      startMs >= horizonEndTimeMs - CLOCK_EPSILON_MS ||
      endMs > horizonEndTimeMs + CLOCK_EPSILON_MS
    ) {
      break;
    }
    fittedCombat.push(combatCandidates[index]);
  }

  const activeRotation = [...setupRotation, ...fittedCombat];
  onSimulation();
  const activeResult = simulate(activeRotation, config);
  const activeEndTimeMs = simulationDurationMs(activeResult);
  const enteredCombatDurationMs = Math.max(
    0,
    Math.min(horizonMs, activeEndTimeMs - combatStartTimeMs),
  );
  const terminalWaitMs = Math.max(
    0,
    Math.round(horizonEndTimeMs - activeEndTimeMs),
  );
  const rotation = terminalWaitMs
    ? [...activeRotation, terminalWait(terminalWaitMs)]
    : activeRotation;

  onSimulation();
  const result = simulate(rotation, config);
  return {
    rotation,
    setupRotation,
    combatRotation: fittedCombat,
    result,
    combatStartTimeMs,
    horizonEndTimeMs,
    enteredCombatDurationMs,
    terminalWaitMs,
    precastActions: Math.max(0, setupRotation.length - 1),
    combatActions: fittedCombat.length,
  };
}
