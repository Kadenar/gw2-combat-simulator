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
  readonly projectedDps: number;
  readonly projectedDamage: number;
  readonly rolloutRotation: LegacyRotationItem[];
  readonly stateKey: string;
  readonly strategicStateKey: string;
  readonly diversityKey: string;
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

function rotationName(entry: LegacyRotationItem): string {
  return String(
    typeof entry === "object" && entry !== null ? entry.name : entry,
  );
}

function strategicValue(value: unknown, depth = 0): unknown {
  if (depth > 3 || value == null) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    const magnitude = Math.max(1, Math.abs(value));
    const bandSize = magnitude >= 100 ? 10 : magnitude >= 10 ? 5 : 1;
    return Math.floor(value / bandSize) * bandSize;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((entry) => strategicValue(entry, depth + 1));
  }
  if (typeof value !== "object") return String(value);
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 24)
      .map(([key, entry]) => [key, strategicValue(entry, depth + 1)]),
  );
}

function strategicStateKey(result: Gw2SimulationResult): string {
  return JSON.stringify({
    activeWeaponSet: result.endState.activeWeaponSet,
    profession: strategicValue(result.endState.profession),
  });
}

function diversityKey(
  result: Gw2SimulationResult,
  rotation: readonly LegacyRotationItem[],
): string {
  return JSON.stringify({
    state: strategicStateKey(result),
    suffix: rotation.slice(-2).map(rotationName),
  });
}

function materializeImplicitHolds(
  normalized: NormalizedFixedWindowRotation,
): LegacyRotationItem[] {
  const byIndex = new Map(
    normalized.result.steps.map((step) => [step.ri, step]),
  );
  const rotation: LegacyRotationItem[] = [];
  let previousEndMs = 0;
  for (let index = 0; index < normalized.rotation.length; index += 1) {
    const entry = normalized.rotation[index];
    const step = byIndex.get(index);
    const startMs = Number(step?.actualStart ?? step?.start ?? previousEndMs);
    if (
      index >= normalized.setupRotation.length &&
      rotationName(entry) !== "__wait" &&
      startMs > previousEndMs + 0.5
    ) {
      rotation.push({
        name: "__wait",
        waitMs: Math.max(1, Math.round(startMs - previousEndMs)),
      });
    }
    rotation.push(entry);
    previousEndMs = Math.max(previousEndMs, Number(step?.end ?? startMs));
  }
  return rotation;
}

function better(left: SearchNode, right: SearchNode): boolean {
  return (
    left.projectedDamage > right.projectedDamage + DAMAGE_EPSILON ||
    (Math.abs(left.projectedDamage - right.projectedDamage) <= DAMAGE_EPSILON &&
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
  const doesNotRegress =
    leftDamage + DAMAGE_EPSILON >= rightDamage &&
    leftDps + DAMAGE_EPSILON >= rightDps;
  return (
    doesNotRegress &&
    (leftDamage > rightDamage + DAMAGE_EPSILON ||
      leftDps > rightDps + DAMAGE_EPSILON)
  );
}

function nodeOrder(left: SearchNode, right: SearchNode): number {
  return (
    right.projectedDamage - left.projectedDamage ||
    right.projectedDps - left.projectedDps ||
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
  const diverse = new Map<string, SearchNode>();
  for (const node of ordered) {
    if (!diverse.has(node.diversityKey)) diverse.set(node.diversityKey, node);
  }
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
  for (const node of diverse.values()) {
    if (selected.size >= Math.max(1, Math.ceil(beamWidth * 0.6))) break;
    selected.add(node);
  }
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
    projectedDps: 0,
    projectedDamage: 0,
    rolloutRotation: rotation,
    stateKey: "initial",
    strategicStateKey: "initial",
    diversityKey: "initial",
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
  if (request.objective != null && request.objective !== "fixed-window-dps") {
    throw new Error(`Unsupported optimizer objective: ${request.objective}`);
  }

  const startedAt = Date.now();
  const horizonMs = finitePositiveInteger(request.horizonMs, 1_000);
  const beamWidth = Math.min(32, finitePositiveInteger(request.beamWidth, 20));
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
  let holdsGenerated = 0;
  let holdsRetained = 0;
  let zeroDamageCandidatesRejected = 0;
  const diversityFamilies = new Set<string>();
  let timedOut = false;
  let stopReason: RotationOptimizerStopReason = "frontier-exhausted";
  const evaluated = (): number => exactEvaluations + projectedEvaluations;
  const hasEvaluationBudget = (required = 1): boolean =>
    evaluated() + required <= evaluationBudget;
  const hasSearchEvaluationBudget = (required = 1): boolean =>
    evaluated() + required + 3 <= evaluationBudget;

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
    const totalDamage = Math.max(0, Number(incumbent.result.totalDamage || 0));
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
        holdsGenerated,
        holdsRetained,
        zeroDamageCandidatesRejected,
        diversityFamilies: diversityFamilies.size,
      },
    };
  };

  if (Date.now() >= deadline) {
    timedOut = true;
    stopReason = "wall-clock-limit";
    return resultFromIncumbent();
  }
  if (!candidates.length || !hasSearchEvaluationBudget()) {
    stopReason = candidates.length ? "evaluation-budget" : "frontier-exhausted";
    return resultFromIncumbent();
  }

  const projectionCache = new Map<string, NormalizedFixedWindowRotation>();
  const projectedScore = (
    rotation: readonly LegacyRotationItem[],
  ): NormalizedFixedWindowRotation | null => {
    const key = JSON.stringify(rotation);
    const cached = projectionCache.get(key);
    if (cached) return cached;
    // Keep one exact validation in reserve so any interruption can still
    // promote the strongest completed rollout to the incumbent.
    if (!hasSearchEvaluationBudget(3)) return null;
    const split = splitRotationAtCombatStart(rotation);
    const projected = normalizeFixedWindowRotation({
      setupRotation: initialRotation,
      combatRotation: split.combatRotation,
      horizonMs,
      config,
      simulate,
      onSimulation: () => {
        projectedEvaluations += 1;
      },
    });
    projectionCache.set(key, projected);
    return projected;
  };

  const withProjection = (
    node: SearchNode,
    projected: NormalizedFixedWindowRotation,
  ): SearchNode => ({
    ...node,
    projectedDps: Math.max(0, Number(projected.result.dps || 0)),
    projectedDamage: Math.max(0, Number(projected.result.totalDamage || 0)),
    rolloutRotation: materializeImplicitHolds(projected),
  });

  const strongerProjection = (
    left: NormalizedFixedWindowRotation | null,
    right: NormalizedFixedWindowRotation | null,
  ): NormalizedFixedWindowRotation | null => {
    if (!left) return right;
    if (!right) return left;
    return betterExact(left, right) ? left : right;
  };

  const rolloutCandidates = candidates
    .filter((candidate) => candidate.declaredDamage)
    .sort((left, right) => left.name.localeCompare(right.name));

  const projectNode = (
    node: SearchNode,
    extraTails: readonly RotationOptimizerCandidate[] = [],
  ): SearchNode | null => {
    let best = projectedScore(node.rotation);
    const combatDepth = Math.max(
      0,
      node.rotation.length - initialRotation.length,
    );
    const incumbentSuffix = baseline.combatRotation.slice(combatDepth);
    if (incumbentSuffix.length) {
      best = strongerProjection(
        projectedScore([...node.rotation, ...incumbentSuffix]),
        best,
      );
    }
    const tails = extraTails.length ? extraTails : rolloutCandidates;
    for (const tail of tails) {
      if (!hasSearchEvaluationBudget(3)) break;
      best = strongerProjection(
        projectedScore([...node.rotation, rotationEntry(tail)]),
        best,
      );
    }
    return best ? withProjection(node, best) : null;
  };

  const projectRelevantEnabler = (
    parent: SearchNode,
    child: SearchNode,
    candidate: RotationOptimizerCandidate,
  ): SearchNode | null => {
    const parentTerminal = projectedScore(parent.rotation);
    let bestChild = projectedScore(child.rotation);
    if (
      bestChild &&
      parentTerminal &&
      Number(bestChild.result.totalDamage || 0) >
        Number(parentTerminal.result.totalDamage || 0) + DAMAGE_EPSILON
    ) {
      return projectNode(child);
    }

    for (const tail of rolloutCandidates) {
      if (!hasSearchEvaluationBudget(6)) break;
      if (tail.weaponSets && !tail.weaponSets.includes(child.activeWeaponSet)) {
        continue;
      }
      const childTail = projectedScore([
        ...child.rotation,
        rotationEntry(tail),
      ]);
      const parentTail = projectedScore([
        ...parent.rotation,
        rotationEntry(tail),
      ]);
      bestChild = strongerProjection(childTail, bestChild);
      if (
        childTail &&
        parentTail &&
        Number(childTail.result.totalDamage || 0) >
          Number(parentTail.result.totalDamage || 0) + DAMAGE_EPSILON
      ) {
        return bestChild ? withProjection(child, bestChild) : null;
      }
    }

    // Weapon/action-bar transitions are independently relevant, but a generic
    // cooldown-only state change is not.
    if (
      candidate.priorityEnabler &&
      child.strategicStateKey !== parent.strategicStateKey
    ) {
      return bestChild ? withProjection(child, bestChild) : projectNode(child);
    }
    zeroDamageCandidatesRejected += 1;
    return null;
  };

  const evaluate = (
    rotation: LegacyRotationItem[],
    parent: SearchNode,
    candidate: RotationOptimizerCandidate | null,
  ): Evaluation | null => {
    if (!hasSearchEvaluationBudget()) return null;
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
    const strategyKey = strategicStateKey(prefix);
    return {
      rotation,
      durationMs,
      combatStartTimeMs,
      availabilityDelayMs: Math.max(0, actionStartMs - parent.durationMs),
      dps: damage / effectiveSeconds,
      damage,
      projectedDps: 0,
      projectedDamage: 0,
      rolloutRotation: rotation,
      stateKey,
      strategicStateKey: strategyKey,
      diversityKey: diversityKey(prefix, rotation),
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
  const rootBase: SearchNode = rootEvaluation.valid
    ? rootEvaluation
    : defaultNode(initialRotation);
  const root: SearchNode = withProjection(rootBase, baseline);
  diversityFamilies.add(root.diversityKey);
  let beam: SearchNode[] = [root];
  const terminals: SearchNode[] = [];
  const projectedNodes: SearchNode[] = [];
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
      if (!hasSearchEvaluationBudget()) {
        stopReason = "evaluation-budget";
        break search;
      }
      if (parent.durationMs >= horizonEndMs - 0.5) {
        terminals.push(parent);
        continue;
      }
      const children: SearchNode[] = [];
      const holdTargets = new Map<number, RotationOptimizerCandidate[]>();
      for (const candidate of candidates) {
        if (Date.now() >= deadline) {
          timedOut = true;
          stopReason = "wall-clock-limit";
          break search;
        }
        if (!hasSearchEvaluationBudget()) {
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
        if (child.availabilityDelayMs > 0.5) {
          const targetMs = Math.round(
            parent.durationMs + child.availabilityDelayMs,
          );
          if (targetMs < horizonEndMs - 0.5) {
            const targetCandidates = holdTargets.get(targetMs) || [];
            targetCandidates.push(candidate);
            holdTargets.set(targetMs, targetCandidates);
          }
          continue;
        }
        const projected = candidate.declaredDamage
          ? projectNode(child)
          : projectRelevantEnabler(parent, child, candidate);
        if (!projected) continue;
        const seen = seenStates.get(projected.stateKey);
        if (seen && !better(projected, seen)) continue;
        seenStates.set(projected.stateKey, projected);
        diversityFamilies.add(projected.diversityKey);
        projectedNodes.push(projected);
        children.push(projected);
      }

      holdsGenerated += holdTargets.size;
      for (const [targetMs, targetCandidates] of holdTargets) {
        if (!hasSearchEvaluationBudget(4)) break;
        const waitMs = Math.max(1, Math.round(targetMs - parent.durationMs));
        const holdEvaluation = evaluate(
          [...parent.rotation, { name: "__wait", waitMs }],
          parent,
          null,
        );
        if (!holdEvaluation?.valid) continue;
        const hold = projectNode(
          {
            ...holdEvaluation,
            potentialEnabler: true,
          },
          targetCandidates,
        );
        const parentTerminal = projectedScore(parent.rotation);
        if (
          !hold ||
          !parentTerminal ||
          hold.projectedDamage <=
            Number(parentTerminal.result.totalDamage || 0) + DAMAGE_EPSILON
        ) {
          continue;
        }
        const seen = seenStates.get(hold.stateKey);
        if (seen && !better(hold, seen)) continue;
        seenStates.set(hold.stateKey, hold);
        holdsRetained += 1;
        diversityFamilies.add(hold.diversityKey);
        projectedNodes.push(hold);
        children.push(hold);
      }
      if (!children.length) {
        terminals.push(parent);
        continue;
      }
      expanded.push(...selectBeam(children, branchLimit, enablerReserve));
    }
    if (!expanded.length) {
      if (!timedOut) {
        stopReason = hasSearchEvaluationBudget()
          ? "frontier-exhausted"
          : "evaluation-budget";
      }
      break;
    }
    const exploredDurationMs = Math.max(
      0,
      ...expanded.map((node) => node.durationMs),
    );
    const exploredCombatDurationMs = Math.max(
      0,
      exploredDurationMs - root.combatStartTimeMs,
    );
    beam = selectBeam(expanded, beamWidth, enablerReserve);
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
      projectedDps: best.projectedDps,
      projectedDamage: best.projectedDamage,
      frontierSize: beam.length,
    });
  }
  if (depth > maxActions) stopReason = "max-actions";

  const frontier = uniqueBestByState([
    ...terminals,
    ...beam,
    ...projectedNodes,
  ]);
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
    const scored = exactScore(finalist.rolloutRotation);
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
      if (rotationName(incumbent.combatRotation[index]) === "__wait") {
        continue;
      }
      const combatRotation = incumbent.combatRotation.filter(
        (_, current) => current !== index,
      );
      const candidate = exactScore(combatRotation);
      if (
        Number(candidate.result.totalDamage || 0) + DAMAGE_EPSILON >=
          Number(incumbent.result.totalDamage || 0) &&
        Number(candidate.result.dps || 0) + DAMAGE_EPSILON >=
          Number(incumbent.result.dps || 0)
      ) {
        incumbent = candidate;
        removedActions += 1;
      }
    }
  }

  return resultFromIncumbent();
}
