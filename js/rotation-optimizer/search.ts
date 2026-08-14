import type {
  LegacyRotationItem,
  SchedulerStep,
} from "../platform/engine/types.js";
import { SIMULATION_RANDOMNESS_MODES } from "../platform/engine/simulation-random.js";
import type { Gw2Config, Gw2SimulationResult } from "../platform/gw2/types.js";
import {
  normalizeFixedWindowRotation,
  normalizeSetupRotation,
  splitRotationAtCombatStart,
  type NormalizedFixedWindowRotation,
} from "./normalization.js";
import type {
  RotationOptimizerCandidate,
  RotationOptimizerProgress,
  RotationOptimizerRequest,
  RotationOptimizerResult,
  RotationOptimizerStopReason,
  RotationSimulation,
} from "./types.js";

interface SearchNode {
  readonly rotation: LegacyRotationItem[];
  readonly durationMs: number;
  readonly combatStartTimeMs: number;
  readonly availabilityDelayMs: number;
  readonly dps: number;
  readonly damage: number;
  readonly stateKey: string;
  readonly marginalDamage: number;
  readonly potentialEnabler: boolean;
  readonly priorityEnabler: boolean;
  readonly activeWeaponSet: number;
}

interface Evaluation extends SearchNode {
  readonly valid: boolean;
}

const DAMAGE_EPSILON = 0.01;

function optimizerConfig(
  config: Gw2Config,
  seed: number | undefined,
): Gw2Config {
  return {
    ...config,
    randomness: {
      ...config.randomness,
      mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
      seed: Number.isFinite(seed) ? Math.max(0, Math.trunc(seed as number)) : 1,
    },
  };
}

function lastActionStep(
  result: Gw2SimulationResult,
  rotationLength: number,
): SchedulerStep | null {
  if (!rotationLength) return null;
  return (
    [...result.steps]
      .reverse()
      .find((step) => step.ri === rotationLength - 1) || null
  );
}

function endStateKey(result: Gw2SimulationResult): string {
  return JSON.stringify({
    time: result.endState.time,
    combatStartTime: result.combatStartTime,
    activeWeaponSet: result.endState.activeWeaponSet,
    cooldowns: result.endState.cooldowns,
    ammo: result.endState.ammo,
    profession: result.endState.profession,
  });
}

function simulationDurationMs(result: Gw2SimulationResult): number {
  return Math.max(
    0,
    Number(result.endState?.time ?? Number(result.duration || 0) * 1000),
  );
}

function rotationEntry(
  candidate: RotationOptimizerCandidate,
): LegacyRotationItem {
  return { name: candidate.name, skillId: candidate.skillId };
}

function better(left: SearchNode, right: SearchNode): boolean {
  return (
    left.dps > right.dps + DAMAGE_EPSILON ||
    (Math.abs(left.dps - right.dps) <= DAMAGE_EPSILON &&
      (left.damage > right.damage + DAMAGE_EPSILON ||
        (Math.abs(left.damage - right.damage) <= DAMAGE_EPSILON &&
          left.rotation.length < right.rotation.length)))
  );
}

function betterExact(
  left: NormalizedFixedWindowRotation,
  right: NormalizedFixedWindowRotation,
): boolean {
  const leftDamage = Number(left.result.totalDamage || 0);
  const rightDamage = Number(right.result.totalDamage || 0);
  const leftDps = Number(left.result.dps || 0);
  const rightDps = Number(right.result.dps || 0);
  return (
    leftDamage > rightDamage + DAMAGE_EPSILON ||
    (Math.abs(leftDamage - rightDamage) <= DAMAGE_EPSILON &&
      leftDps > rightDps + DAMAGE_EPSILON)
  );
}

function nodeOrder(left: SearchNode, right: SearchNode): number {
  return (
    right.dps - left.dps ||
    right.damage - left.damage ||
    left.durationMs - right.durationMs ||
    left.rotation.length - right.rotation.length
  );
}

function uniqueBestByState(nodes: readonly SearchNode[]): SearchNode[] {
  const unique = new Map<string, SearchNode>();
  for (const node of nodes) {
    const current = unique.get(node.stateKey);
    if (!current || better(node, current)) unique.set(node.stateKey, node);
  }
  return [...unique.values()];
}

function selectBeam(
  nodes: readonly SearchNode[],
  beamWidth: number,
  enablerReserve: number,
): SearchNode[] {
  const ordered = uniqueBestByState(nodes).sort(nodeOrder);
  const priorityReserved = ordered
    .filter(
      (node) => node.priorityEnabler && node.marginalDamage <= DAMAGE_EPSILON,
    )
    .slice(0, Math.min(1, beamWidth));
  const reserved = ordered
    .filter(
      (node) =>
        node.potentialEnabler &&
        node.marginalDamage <= DAMAGE_EPSILON &&
        !priorityReserved.includes(node),
    )
    .slice(0, Math.min(enablerReserve, beamWidth - priorityReserved.length));
  const selected = new Set([...priorityReserved, ...reserved]);
  for (const node of ordered) {
    if (selected.size >= beamWidth) break;
    selected.add(node);
  }
  return [...selected].sort(nodeOrder);
}

function defaultNode(rotation: LegacyRotationItem[] = []): SearchNode {
  return {
    rotation,
    durationMs: 0,
    combatStartTimeMs: 0,
    availabilityDelayMs: 0,
    dps: 0,
    damage: 0,
    stateKey: "initial",
    marginalDamage: 0,
    potentialEnabler: false,
    priorityEnabler: false,
    activeWeaponSet: 1,
  };
}

function finitePositiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.round(number))
    : fallback;
}

export function runRotationSearch(
  request: RotationOptimizerRequest,
  simulate: RotationSimulation,
  onProgress: (progress: RotationOptimizerProgress) => void = () => {},
): RotationOptimizerResult {
  if (
    request.objective != null &&
    request.objective !== "fixed-window-dps"
  ) {
    throw new Error(`Unsupported optimizer objective: ${request.objective}`);
  }

  const startedAt = Date.now();
  const horizonMs = finitePositiveInteger(request.horizonMs, 1_000);
  const beamWidth = finitePositiveInteger(request.beamWidth, 8);
  const branchLimit = finitePositiveInteger(request.branchLimit, 6);
  const enablerReserve = Math.max(
    0,
    Math.round(Number(request.enablerReserve ?? 2)),
  );
  const maxActions = finitePositiveInteger(request.maxActions, 60);
  const evaluationBudget = finitePositiveInteger(
    request.evaluationBudget,
    5_000,
  );
  const wallClockLimitMs = finitePositiveInteger(
    request.wallClockLimitMs ?? request.timeBudgetMs,
    15_000,
  );
  const deadline = startedAt + wallClockLimitMs;
  const candidates = request.candidates.filter(
    (candidate) => candidate.skillId != null && candidate.name,
  );
  const config = optimizerConfig(request.config, request.seed);
  const initialRotation = normalizeSetupRotation(request.setupRotation);
  const incumbentInput = request.incumbentRotation || [];

  let exactEvaluations = 0;
  let projectedEvaluations = 0;
  let frontierPeak = 0;
  let removedActions = 0;
  let timedOut = false;
  let stopReason: RotationOptimizerStopReason = "frontier-exhausted";
  const evaluated = (): number => exactEvaluations + projectedEvaluations;
  const hasEvaluationBudget = (required = 1): boolean =>
    evaluated() + required <= evaluationBudget;

  const exactScore = (
    rotation: readonly LegacyRotationItem[],
    setupRotation: readonly LegacyRotationItem[] = initialRotation,
  ): NormalizedFixedWindowRotation => {
    const split = splitRotationAtCombatStart(rotation);
    return normalizeFixedWindowRotation({
      setupRotation,
      combatRotation: split.combatRotation,
      horizonMs,
      config,
      simulate,
      onSimulation: () => {
        exactEvaluations += 1;
      },
    });
  };

  // Baseline validation is mandatory even when its normalization consumes the
  // entire requested search budget.
  const baseline = normalizeFixedWindowRotation({
    setupRotation: initialRotation,
    combatRotation: incumbentInput,
    horizonMs,
    config,
    simulate,
    onSimulation: () => {
      exactEvaluations += 1;
    },
  });
  let incumbent = baseline;
  const horizonEndMs = baseline.horizonEndTimeMs;

  const resultFromIncumbent = (): RotationOptimizerResult => {
    const baselineDps = Math.max(0, Number(baseline.result.dps || 0));
    const baselineDamage = Math.max(
      0,
      Number(baseline.result.totalDamage || 0),
    );
    const dps = Math.max(0, Number(incumbent.result.dps || 0));
    const totalDamage = Math.max(
      0,
      Number(incumbent.result.totalDamage || 0),
    );
    const improved = betterExact(incumbent, baseline);
    const improvementDps = dps - baselineDps;
    return {
      rotation: incumbent.rotation,
      dps,
      totalDamage,
      baselineDps,
      baselineDamage,
      improvementDps,
      improvementPercent:
        baselineDps > 0
          ? (improvementDps / baselineDps) * 100
          : improved
            ? 100
            : 0,
      horizonMs,
      combatStartTimeMs: incumbent.combatStartTimeMs,
      precastActions: incumbent.precastActions,
      activeDurationMs: incumbent.enteredCombatDurationMs,
      completedHorizon: incumbent.terminalWaitMs === 0,
      actions: incumbent.combatActions,
      combatActions: incumbent.combatActions,
      evaluated: evaluated(),
      exactEvaluations,
      projectedEvaluations,
      removedActions,
      timedOut,
      improved,
      diagnostics: {
        baselineDps,
        baselineDamage,
        incumbentDps: dps,
        incumbentDamage: totalDamage,
        exactEvaluations,
        projectedEvaluations,
        frontierPeak,
        stopReason,
        removedZeroDamageActions: removedActions,
      },
    };
  };

  if (Date.now() >= deadline) {
    timedOut = true;
    stopReason = "wall-clock-limit";
    return resultFromIncumbent();
  }
  if (!candidates.length || !hasEvaluationBudget()) {
    stopReason = candidates.length
      ? "evaluation-budget"
      : "frontier-exhausted";
    return resultFromIncumbent();
  }

  const evaluate = (
    rotation: LegacyRotationItem[],
    parent: SearchNode,
    candidate: RotationOptimizerCandidate | null,
  ): Evaluation | null => {
    if (!hasEvaluationBudget()) return null;
    const prefix = simulate(rotation, config);
    projectedEvaluations += 1;
    const step = lastActionStep(prefix, rotation.length);
    const durationMs = simulationDurationMs(prefix);
    const combatStartTimeMs = Math.max(
      0,
      Number(prefix.combatStartTime ?? parent.combatStartTimeMs / 1000) * 1000,
    );
    const actionStartMs = Math.max(
      0,
      Number(step?.actualStart ?? step?.start ?? parent.durationMs),
    );
    if (
      step?.invalid ||
      durationMs > horizonEndMs + 0.5 ||
      Number(step?.actualStart ?? step?.start ?? 0) >= horizonEndMs
    ) {
      return {
        ...defaultNode(rotation),
        durationMs,
        combatStartTimeMs,
        valid: false,
      };
    }

    const effectiveSeconds = Math.max(
      0.001,
      (prefix.deathTime == null
        ? durationMs / 1000
        : Number(prefix.deathTime)) -
        combatStartTimeMs / 1000,
    );
    const damage = Math.max(0, Number(prefix.totalDamage || 0));
    const stateKey = endStateKey(prefix);
    return {
      rotation,
      durationMs,
      combatStartTimeMs,
      availabilityDelayMs: Math.max(0, actionStartMs - parent.durationMs),
      dps: damage / effectiveSeconds,
      damage,
      stateKey,
      marginalDamage: damage - parent.damage,
      potentialEnabler: Boolean(candidate?.potentialEnabler),
      priorityEnabler: Boolean(candidate?.priorityEnabler),
      activeWeaponSet: Number(prefix.endState.activeWeaponSet || 1),
      valid:
        candidate === null ||
        durationMs > parent.durationMs + 0.5 ||
        stateKey !== parent.stateKey,
    };
  };

  const rootEvaluation = evaluate(
    initialRotation,
    defaultNode(initialRotation),
    null,
  );
  if (!rootEvaluation) {
    stopReason = "evaluation-budget";
    return resultFromIncumbent();
  }
  const root: SearchNode = rootEvaluation.valid
    ? rootEvaluation
    : defaultNode(initialRotation);
  let beam: SearchNode[] = [root];
  const terminals: SearchNode[] = [];
  const seenStates = new Map<string, SearchNode>([[root.stateKey, root]]);
  let depth = 0;

  search: for (depth = 1; depth <= maxActions; depth += 1) {
    const expanded: SearchNode[] = [];
    for (const parent of beam) {
      if (Date.now() >= deadline) {
        timedOut = true;
        stopReason = "wall-clock-limit";
        break search;
      }
      if (!hasEvaluationBudget()) {
        stopReason = "evaluation-budget";
        break search;
      }
      if (parent.durationMs >= horizonEndMs - 0.5) {
        terminals.push(parent);
        continue;
      }
      const children: SearchNode[] = [];
      for (const candidate of candidates) {
        if (Date.now() >= deadline) {
          timedOut = true;
          stopReason = "wall-clock-limit";
          break search;
        }
        if (!hasEvaluationBudget()) {
          stopReason = "evaluation-budget";
          break search;
        }
        if (
          candidate.weaponSets &&
          !candidate.weaponSets.includes(parent.activeWeaponSet)
        ) {
          continue;
        }
        const child = evaluate(
          [...parent.rotation, rotationEntry(candidate)],
          parent,
          candidate,
        );
        if (!child?.valid) continue;
        const seen = seenStates.get(child.stateKey);
        if (seen && !better(child, seen)) continue;
        seenStates.set(child.stateKey, child);
        children.push(child);
      }
      if (!children.length) {
        terminals.push(parent);
        continue;
      }
      const earliestAvailability = Math.min(
        ...children.map((child) => child.availabilityDelayMs),
      );
      const chronologicalChildren = children.filter(
        (child) => child.availabilityDelayMs <= earliestAvailability + 0.5,
      );
      expanded.push(
        ...selectBeam(chronologicalChildren, branchLimit, enablerReserve),
      );
    }
    if (!expanded.length) {
      if (!timedOut) {
        stopReason = hasEvaluationBudget()
          ? "frontier-exhausted"
          : "evaluation-budget";
      }
      break;
    }
    const explorationHorizonMs = Math.min(10_000, horizonMs * 0.25);
    const exploredDurationMs = Math.max(
      0,
      ...expanded.map((node) => node.durationMs),
    );
    const exploredCombatDurationMs = Math.max(
      0,
      exploredDurationMs - root.combatStartTimeMs,
    );
    const activeBeamWidth =
      horizonMs >= 30_000 && exploredCombatDurationMs >= explorationHorizonMs
        ? 1
        : beamWidth;
    beam = selectBeam(
      expanded,
      activeBeamWidth,
      activeBeamWidth > 1 ? enablerReserve : 0,
    );
    frontierPeak = Math.max(frontierPeak, beam.length);
    const best = beam[0] || root;
    onProgress({
      depth,
      simulatedTimeMs: Math.min(horizonMs, exploredCombatDurationMs),
      precastDurationMs: root.combatStartTimeMs,
      evaluated: evaluated(),
      evaluationBudget,
      bestDps: Number(incumbent.result.dps || 0),
      bestDamage: Number(incumbent.result.totalDamage || 0),
      projectedDps: best.dps,
      projectedDamage: best.damage,
      frontierSize: beam.length,
    });
  }
  if (depth > maxActions) stopReason = "max-actions";

  const frontier = uniqueBestByState([...terminals, ...beam]);
  const finalists = [
    ...[...frontier].sort(nodeOrder).slice(0, Math.max(beamWidth, 4)),
    ...[...frontier]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, Math.max(beamWidth, 4)),
  ].filter((node, index, nodes) => nodes.indexOf(node) === index);

  for (const finalist of finalists) {
    if (Date.now() >= deadline) {
      timedOut = true;
      stopReason = "wall-clock-limit";
      break;
    }
    if (!hasEvaluationBudget(3)) {
      if (!timedOut) stopReason = "evaluation-budget";
      break;
    }
    const scored = exactScore(finalist.rotation);
    if (betterExact(scored, incumbent)) incumbent = scored;
  }

  // Cleanup is only applied to an improved search result. A no-improvement
  // response must return the normalized loaded incumbent unchanged.
  if (betterExact(incumbent, baseline)) {
    for (
      let index = incumbent.combatRotation.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (Date.now() >= deadline || !hasEvaluationBudget(3)) break;
      const combatRotation = incumbent.combatRotation.filter(
        (_, current) => current !== index,
      );
      const candidate = exactScore(combatRotation);
      if (
        Number(candidate.result.totalDamage || 0) + DAMAGE_EPSILON >=
        Number(incumbent.result.totalDamage || 0)
      ) {
        incumbent = candidate;
        removedActions += 1;
      }
    }
  }

  return resultFromIncumbent();
}
