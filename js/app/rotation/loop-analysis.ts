import { eventCausalOrder } from '../../platform/engine/events.js';
import type { SchedulerStep, SimulationEvent, Skill, SkillId } from '../../platform/engine/types.js';
import { createGw2TimelineIndex } from '../../platform/gw2/timeline-index.js';
import type { ProfessionAppState } from '../profession/types.js';

const MIN_LOOP_TOKENS = 4;
const MIN_STRUCTURAL_LOOP_TOKENS = 3;
const MIN_CLUSTER_SIMILARITY = 0.58;
const MIN_BOUNDARY_COHORT_SIMILARITY = 0.35;
const MIN_STEP_SUPPORT = 0.5;
const MAX_DETECTED_LOOPS = 4;
const MAX_BOUNDARY_ANCHOR_STEPS = 4;
const MAX_BOUNDARY_GUIDE_STEPS = 8;
const FALLBACK_ANCHOR_SIZE = 3;
const MAX_FALLBACK_PERIOD = 64;

export type RotationLoopConfidence = 'high' | 'medium' | 'low';

export interface RotationLoopStep {
  readonly key: string;
  readonly kind: 'skill' | 'auto-chain' | 'gap';
  readonly name: string;
  readonly primarySkillId: SkillId;
  readonly skillIds: readonly SkillId[];
  readonly iconVariants: readonly string[];
  readonly minimumCount: number;
  readonly maximumCount: number;
  readonly support: number;
  readonly placement: 'fixed' | 'flexible';
  readonly followsPreviousImmediately: boolean;
}

export interface RotationLoopOccurrence {
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly rotationIndices: readonly number[];
  readonly editCount: number;
}

export interface DetectedRotationLoop {
  readonly id: string;
  readonly label: string;
  readonly confidence: RotationLoopConfidence;
  readonly confidenceScore: number;
  readonly consistency: number;
  readonly mode: 'consensus' | 'boundary-guide';
  readonly steps: readonly RotationLoopStep[];
  readonly occurrences: readonly RotationLoopOccurrence[];
  readonly averageDurationMs: number;
}

export interface RotationLoopAnalysis {
  readonly loops: readonly DetectedRotationLoop[];
  readonly openerSteps: readonly RotationLoopStep[];
  readonly analyzedActionCount: number;
  readonly coveredActionCount: number;
  readonly openerActionCount: number;
  readonly trailingActionCount: number;
}

interface NormalizedAction {
  readonly sequenceIndex: number;
  readonly skillId: SkillId;
  readonly name: string;
  readonly icon: string;
  readonly activationId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly rotationIndex: number | null;
  readonly weaponSet: number;
  readonly attunement: string;
  readonly cancelled: boolean;
}

interface LoopToken {
  readonly key: string;
  readonly kind: Exclude<RotationLoopStep['kind'], 'gap'>;
  readonly name: string;
  readonly primarySkillId: SkillId;
  readonly skillIds: readonly SkillId[];
  readonly count: number;
  readonly actions: readonly NormalizedAction[];
}

interface RotationSegment {
  readonly sourceIndex: number;
  readonly laneKey: string;
  readonly label: string;
  readonly complete: boolean;
  readonly tokens: readonly LoopToken[];
  readonly actions: readonly NormalizedAction[];
}

interface SegmentCluster {
  readonly segments: readonly RotationSegment[];
  readonly medoid: RotationSegment;
  readonly meanSimilarity: number;
  readonly boundaryDriven: boolean;
  readonly label: string;
}

interface SequenceAlignment {
  readonly matches: readonly (LoopToken | null)[];
  readonly insertions: readonly { readonly slot: number; readonly token: LoopToken }[];
}

interface OrderedConsensusStep {
  readonly slot: number;
  readonly insertion: boolean;
  readonly step: RotationLoopStep;
}

const analysisCache = new WeakMap<
  object,
  {
    readonly catalog: object;
    readonly buildSignature: string;
    readonly analysis: RotationLoopAnalysis;
  }
>();

const skillKey = (skillId: SkillId): string => `skill:${String(skillId)}`;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function matchingSkillId(left: SkillId, right: SkillId): boolean {
  return String(left) === String(right);
}

function actionSkill(app: ProfessionAppState, skillId: SkillId): Skill | undefined {
  const numericId = Number(skillId);
  return (
    app.skillById.get(skillId) ||
    (Number.isFinite(numericId) ? app.skillById.get(numericId) : undefined) ||
    app.skills.find((candidate) => matchingSkillId(candidate.id, skillId))
  );
}

function actionSkillName(app: ProfessionAppState, event: SimulationEvent, skillId: SkillId): string {
  const skill = actionSkill(app, skillId);
  return String(skill?.name || event.skillName || event.name || skillId);
}

function actionSkillIcon(
  app: ProfessionAppState,
  event: SimulationEvent,
  skill: Skill | undefined,
  rotationIndex: number | null
): string {
  const defaultIcon = String(event.icon || skill?.icon || '');
  if (!skill || rotationIndex == null) return defaultIcon;
  // Profession projections can resolve stateful variants such as the destination portrait for a Revenant legend swap.
  return String(
    app.profession.ui.timelineSkillIcon?.({
      entry: app.build.rotation[rotationIndex],
      index: rotationIndex,
      rotation: app.build.rotation,
      build: app.build,
      catalog: app.activeCatalog,
      skill,
      defaultIcon
    }) || defaultIcon
  );
}

function attunementDestination(name: string): string {
  return name.match(/^(Fire|Water|Air|Earth) Attunement$/)?.[1] || '';
}

function normalizedPlayerActions(app: ProfessionAppState): NormalizedAction[] {
  const result = app.results;
  if (!result) return [];
  const stepByActivationId = new Map<string, SchedulerStep>();
  for (const step of result.steps || []) {
    if (step.activationId) stepByActivationId.set(step.activationId, step);
  }

  const timeline = createGw2TimelineIndex({
    config: { startingWeaponSet: app.build.startingWeaponSet },
    events: result.events
  });
  const events = [...(result.events || [])]
    .filter((event) => event.type === 'action' && (!event.actorType || event.actorType === 'player'))
    .sort(
      (left, right) =>
        Number(left.at || 0) - Number(right.at || 0) || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0)
    );
  const actions: NormalizedAction[] = [];
  let activeAttunement = String(app.build.startAttunement || 'Fire');
  for (const event of events) {
    const activationId = String(event.activationId || '');
    const step = activationId ? stepByActivationId.get(activationId) : undefined;
    if (step?.invalid) continue;
    const skillId = event.skillId ?? event.sourceId;
    if (skillId == null || skillId === '') continue;
    const eventStartMs = Math.round(Number(event.at || 0) * 1000);
    const eventEndMs = Math.round(Number(event.endsAt ?? event.at ?? 0) * 1000);
    const rotationIndex = step && step.ri >= 0 ? step.ri : null;
    const skill = actionSkill(app, skillId);
    const name = actionSkillName(app, event, skillId);
    actions.push({
      sequenceIndex: actions.length,
      skillId,
      name,
      icon: actionSkillIcon(app, event, skill, rotationIndex),
      activationId,
      startMs: Number(step?.start ?? eventStartMs),
      endMs: Number(step?.end ?? eventEndMs),
      rotationIndex,
      weaponSet: timeline.activeWeaponSetAt(Number(event.at || 0)),
      attunement: activeAttunement,
      cancelled: event.cancelled === true
    });
    const destination = attunementDestination(name);
    if (destination && event.cancelled !== true) activeAttunement = destination;
  }
  // A lone cancelled-before-commit attempt is noise rather than an authored
  // loop step. Repeated cancellations remain visible because they may be an
  // intentional benchmark technique.
  const cancelledCounts = new Map<string, number>();
  for (const action of actions) {
    if (action.cancelled) {
      const key = skillKey(action.skillId);
      cancelledCounts.set(key, (cancelledCounts.get(key) || 0) + 1);
    }
  }
  return actions
    .filter((action) => !action.cancelled || (cancelledCounts.get(skillKey(action.skillId)) || 0) > 1)
    .map((action, sequenceIndex) => ({ ...action, sequenceIndex }));
}

function catalogAutoattackChains(app: ProfessionAppState): ReadonlyMap<string, readonly SkillId[]> {
  const chains = new Map<string, readonly SkillId[]>();
  for (const chain of app.activeCatalog.autoattackChains || []) {
    if (chain.length > 1) chains.set(String(chain[0]), chain);
  }
  return chains;
}

function baseSkillToken(action: NormalizedAction): LoopToken {
  return {
    key: skillKey(action.skillId),
    kind: 'skill',
    name: action.name,
    primarySkillId: action.skillId,
    skillIds: [action.skillId],
    count: 1,
    actions: [action]
  };
}

function combineConsecutiveTokens(tokens: readonly LoopToken[]): LoopToken[] {
  const combined: LoopToken[] = [];
  for (const token of tokens) {
    const previous = combined.at(-1);
    if (previous?.key === token.key && previous.kind === token.kind) {
      combined[combined.length - 1] = {
        ...previous,
        count: previous.count + token.count,
        actions: [...previous.actions, ...token.actions]
      };
      continue;
    }
    combined.push(token);
  }
  return combined;
}

function tokenizeActions(
  actions: readonly NormalizedAction[],
  autoattackChains: ReadonlyMap<string, readonly SkillId[]>
): LoopToken[] {
  // Instant casts can be interleaved between autoattack steps without breaking
  // the chain, so claim complete chains before emitting the surrounding tokens.
  const autoattackRootBySkill = new Map<string, SkillId>();
  for (const chain of autoattackChains.values()) {
    for (const skillId of chain) autoattackRootBySkill.set(String(skillId), chain[0]);
  }
  const claimedChainIndexes = new Set<number>();
  const chainTokenByStart = new Map<number, LoopToken>();
  for (let start = 0; start < actions.length; start += 1) {
    if (claimedChainIndexes.has(start)) continue;
    const chain = autoattackChains.get(String(actions[start].skillId));
    if (!chain) continue;
    const matchedIndexes = [start];
    let cursor = start + 1;
    let complete = true;
    for (const expectedSkillId of chain.slice(1)) {
      let matchedIndex = -1;
      const scanEnd = Math.min(actions.length, cursor + 6);
      for (let candidateIndex = cursor; candidateIndex < scanEnd; candidateIndex += 1) {
        const candidate = actions[candidateIndex];
        if (matchingSkillId(candidate.skillId, expectedSkillId)) {
          matchedIndex = candidateIndex;
          break;
        }
        if (autoattackRootBySkill.get(String(candidate.skillId)) === chain[0]) break;
      }
      if (matchedIndex < 0 || actions[matchedIndex].startMs - actions[start].startMs > 5000) {
        complete = false;
        break;
      }
      matchedIndexes.push(matchedIndex);
      cursor = matchedIndex + 1;
    }
    if (!complete) continue;
    const chainActions = matchedIndexes.map((index) => actions[index]);
    for (const index of matchedIndexes) claimedChainIndexes.add(index);
    chainTokenByStart.set(start, {
      key: `auto-chain:${String(chain[0])}`,
      kind: 'auto-chain',
      name: 'Auto Attack Chain',
      primarySkillId: chain[0],
      skillIds: chain,
      count: 1,
      actions: chainActions
    });
  }

  const tokens: LoopToken[] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const chainToken = chainTokenByStart.get(index);
    if (chainToken) {
      tokens.push(chainToken);
      continue;
    }
    if (claimedChainIndexes.has(index)) continue;
    const incompleteChainRoot = autoattackRootBySkill.get(String(action.skillId));
    if (incompleteChainRoot != null) {
      tokens.push({
        ...baseSkillToken(action),
        key: `auto-chain-fragment:${String(incompleteChainRoot)}`
      });
      continue;
    }
    tokens.push(baseSkillToken(action));
  }
  return combineConsecutiveTokens(tokens);
}

function weaponSetName(app: ProfessionAppState, weaponSet: number): string {
  const weapons = weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  const names = (weapons || []).map(String).filter(Boolean);
  return names.length ? names.join(' / ') : `Weapon Set ${weaponSet}`;
}

function physicalWeaponSwapEnabled(app: ProfessionAppState): boolean {
  return (
    app.profession.ui.weaponSwapChangesSet !== false &&
    (app.build.alternateWeapons || []).some((weapon) => Boolean(String(weapon || '').trim()))
  );
}

function structuralSegments(
  app: ProfessionAppState,
  actions: readonly NormalizedAction[],
  autoattackChains: ReadonlyMap<string, readonly SkillId[]>
): RotationSegment[] {
  if (app.build.profession === 'elementalist') {
    const segments: RotationSegment[] = [];
    let pending: NormalizedAction[] = [];
    let pendingAttunement = '';
    const append = (complete: boolean): void => {
      if (!pending.length) return;
      segments.push({
        sourceIndex: segments.length,
        laneKey: `attunement:${pendingAttunement}`,
        label: `${pendingAttunement} Attunement Loop`,
        complete,
        tokens: tokenizeActions(pending, autoattackChains),
        actions: pending
      });
      pending = [];
    };
    for (const action of actions) {
      if (pending.length && action.attunement !== pendingAttunement) append(true);
      if (!pending.length) pendingAttunement = action.attunement;
      pending.push(action);
    }
    append(false);
    return segments;
  }
  if (!physicalWeaponSwapEnabled(app)) return [];
  const segments: RotationSegment[] = [];
  let pending: NormalizedAction[] = [];
  const append = (complete: boolean): void => {
    if (!pending.length) return;
    const weaponSet = pending[0].weaponSet;
    segments.push({
      sourceIndex: segments.length,
      laneKey: `weapon-set:${weaponSet}`,
      label: `${weaponSetName(app, weaponSet)} Loop`,
      complete,
      tokens: tokenizeActions(pending, autoattackChains),
      actions: pending
    });
    pending = [];
  };

  for (const action of actions) {
    pending.push(action);
    if (action.name === 'Swap Weapons') append(true);
  }
  append(false);
  return segments;
}

function sequenceEditDistance(left: readonly LoopToken[], right: readonly LoopToken[]): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = left[leftIndex - 1].key === right[rightIndex - 1].key ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitution
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function sequenceSimilarity(left: readonly LoopToken[], right: readonly LoopToken[]): number {
  const length = Math.max(left.length, right.length);
  return length ? 1 - sequenceEditDistance(left, right) / length : 1;
}

function medoidOf(segments: readonly RotationSegment[]): RotationSegment {
  return [...segments].sort((left, right) => {
    const leftDistance = segments.reduce(
      (total, candidate) => total + sequenceEditDistance(left.tokens, candidate.tokens),
      0
    );
    const rightDistance = segments.reduce(
      (total, candidate) => total + sequenceEditDistance(right.tokens, candidate.tokens),
      0
    );
    return leftDistance - rightDistance || left.sourceIndex - right.sourceIndex;
  })[0];
}

function clusterMeanSimilarity(segments: readonly RotationSegment[], medoid: RotationSegment): number {
  return (
    segments.reduce((total, segment) => total + sequenceSimilarity(segment.tokens, medoid.tokens), 0) /
    Math.max(1, segments.length)
  );
}

function bestSimilarCluster(
  segments: readonly RotationSegment[],
  minimumSimilarity = MIN_CLUSTER_SIMILARITY
): Omit<SegmentCluster, 'boundaryDriven' | 'label'> | null {
  let best: Omit<SegmentCluster, 'boundaryDriven' | 'label'> | null = null;
  let bestScore = -Infinity;
  for (const seed of segments) {
    const neighbors = segments.filter(
      (candidate) => sequenceSimilarity(seed.tokens, candidate.tokens) >= minimumSimilarity
    );
    if (neighbors.length < 2) continue;
    const initialMedoid = medoidOf(neighbors);
    const members = neighbors.filter(
      (candidate) => sequenceSimilarity(initialMedoid.tokens, candidate.tokens) >= minimumSimilarity
    );
    if (members.length < 2) continue;
    const medoid = medoidOf(members);
    const meanSimilarity = clusterMeanSimilarity(members, medoid);
    const averageLength = members.reduce((total, member) => total + member.tokens.length, 0) / members.length;
    const score = members.length * averageLength * meanSimilarity;
    if (score > bestScore) {
      bestScore = score;
      best = { segments: members, medoid, meanSimilarity };
    }
  }
  return best;
}

function boundaryClusters(segments: readonly RotationSegment[]): SegmentCluster[] {
  const byLane = new Map<string, RotationSegment[]>();
  for (const segment of segments) {
    // Explicit weapon/attunement boundaries make short loops meaningful even
    // when they do not meet the stricter generic pattern-matching threshold.
    if (!segment.complete || segment.tokens.length < MIN_STRUCTURAL_LOOP_TOKENS) continue;
    const lane = byLane.get(segment.laneKey) || [];
    lane.push(segment);
    byLane.set(segment.laneKey, lane);
  }

  const clusters: SegmentCluster[] = [];
  for (const laneSegments of byLane.values()) {
    const best = bestSimilarCluster(laneSegments);
    if (!best) continue;
    clusters.push({
      ...best,
      boundaryDriven: true,
      label: best.medoid.label
    });
  }
  return clusters;
}

function boundaryGuideClusters(segments: readonly RotationSegment[]): SegmentCluster[] {
  const byLane = new Map<string, RotationSegment[]>();
  for (const segment of segments) {
    if (segment.tokens.length < MIN_STRUCTURAL_LOOP_TOKENS) continue;
    const lane = byLane.get(segment.laneKey) || [];
    lane.push(segment);
    byLane.set(segment.laneKey, lane);
  }

  const guides: SegmentCluster[] = [];
  for (const laneSegments of byLane.values()) {
    const completeSegments = laneSegments.filter((segment) => segment.complete);
    const candidates = completeSegments.length >= 2 ? completeSegments : laneSegments;
    if (candidates.length < 2) continue;
    const typicalLength = median(candidates.map((segment) => segment.tokens.length));
    // A short first pass or a full-length burst with a distinct sequence is
    // usually the opener. Group similarly sized, loosely related lane visits.
    const representativeSegments = candidates.filter(
      (segment) =>
        segment.tokens.length >= Math.max(MIN_STRUCTURAL_LOOP_TOKENS, typicalLength * 0.55) &&
        segment.tokens.length <= typicalLength * 1.8
    );
    if (representativeSegments.length < 2) continue;
    const cohort = bestSimilarCluster(representativeSegments, MIN_BOUNDARY_COHORT_SIMILARITY);
    const guideSegments = cohort?.segments || representativeSegments;
    const medoid = cohort?.medoid || medoidOf(guideSegments);
    guides.push({
      segments: guideSegments,
      medoid,
      meanSimilarity: cohort?.meanSimilarity || clusterMeanSimilarity(guideSegments, medoid),
      boundaryDriven: true,
      label: medoid.label
    });
  }
  return guides;
}

function segmentFromTokens(
  tokens: readonly LoopToken[],
  sourceIndex: number,
  laneKey = 'fallback'
): RotationSegment | null {
  const actions = tokens.flatMap((token) => token.actions);
  if (tokens.length < MIN_LOOP_TOKENS || !actions.length) return null;
  return {
    sourceIndex,
    laneKey,
    label: 'Core Loop',
    complete: true,
    tokens,
    actions
  };
}

function fallbackAnchorClusters(
  actions: readonly NormalizedAction[],
  autoattackChains: ReadonlyMap<string, readonly SkillId[]>
): SegmentCluster[] {
  const tokens = tokenizeActions(actions, autoattackChains);
  if (tokens.length < MIN_LOOP_TOKENS * 2) return [];
  const positionsByAnchor = new Map<string, number[]>();
  for (let index = 0; index <= tokens.length - FALLBACK_ANCHOR_SIZE; index += 1) {
    const anchor = tokens
      .slice(index, index + FALLBACK_ANCHOR_SIZE)
      .map((token) => token.key)
      .join('|');
    const positions = positionsByAnchor.get(anchor) || [];
    positions.push(index);
    positionsByAnchor.set(anchor, positions);
  }

  const candidates: SegmentCluster[] = [];
  let sourceIndex = 0;
  for (const positions of positionsByAnchor.values()) {
    if (positions.length < 3) continue;
    const intervals: RotationSegment[] = [];
    for (let index = 0; index < positions.length - 1; index += 1) {
      const start = positions[index];
      const end = positions[index + 1];
      const segment = segmentFromTokens(tokens.slice(start, end), sourceIndex++);
      if (segment) intervals.push(segment);
    }
    const best = bestSimilarCluster(intervals);
    if (!best) continue;
    candidates.push({ ...best, boundaryDriven: false, label: 'Core Loop' });
  }
  return candidates;
}

function fallbackTandemClusters(
  actions: readonly NormalizedAction[],
  autoattackChains: ReadonlyMap<string, readonly SkillId[]>
): SegmentCluster[] {
  const tokens = tokenizeActions(actions, autoattackChains);
  const candidates: SegmentCluster[] = [];
  let sourceIndex = 0;
  const maximumPeriod = Math.min(MAX_FALLBACK_PERIOD, Math.floor(tokens.length / 2));
  for (let period = MIN_LOOP_TOKENS; period <= maximumPeriod; period += 1) {
    for (let start = 0; start + period * 2 <= tokens.length; start += 1) {
      const leftTokens = tokens.slice(start, start + period);
      const rightTokens = tokens.slice(start + period, start + period * 2);
      const positionalMatches = leftTokens.reduce(
        (count, token, index) => count + (token.key === rightTokens[index].key ? 1 : 0),
        0
      );
      if (positionalMatches / period < 0.75) continue;
      const left = segmentFromTokens(leftTokens, sourceIndex++);
      const right = segmentFromTokens(rightTokens, sourceIndex++);
      if (!left || !right) continue;
      const meanSimilarity = sequenceSimilarity(left.tokens, right.tokens);
      if (meanSimilarity < MIN_CLUSTER_SIMILARITY) continue;
      candidates.push({
        segments: [left, right],
        medoid: medoidOf([left, right]),
        meanSimilarity,
        boundaryDriven: false,
        label: 'Core Loop'
      });
    }
  }
  return candidates;
}

function occurrenceSignature(cluster: SegmentCluster): string {
  return cluster.segments
    .map((segment) => {
      const first = segment.actions[0]?.sequenceIndex ?? -1;
      const last = segment.actions.at(-1)?.sequenceIndex ?? -1;
      return `${first}:${last}`;
    })
    .sort()
    .join('|');
}

function occurrenceOverlap(left: SegmentCluster, right: SegmentCluster): number {
  const leftActions = new Set(
    left.segments.flatMap((segment) => segment.actions.map((action) => action.sequenceIndex))
  );
  const rightActions = new Set(
    right.segments.flatMap((segment) => segment.actions.map((action) => action.sequenceIndex))
  );
  if (!leftActions.size || !rightActions.size) return 0;
  let intersection = 0;
  for (const action of leftActions) {
    if (rightActions.has(action)) intersection += 1;
  }
  return intersection / Math.min(leftActions.size, rightActions.size);
}

function selectFallbackClusters(candidates: readonly SegmentCluster[]): SegmentCluster[] {
  const bySignature = new Map<string, SegmentCluster>();
  for (const candidate of candidates) {
    const signature = occurrenceSignature(candidate);
    const existing = bySignature.get(signature);
    if (!existing || candidate.meanSimilarity > existing.meanSimilarity) bySignature.set(signature, candidate);
  }
  const ranked = [...bySignature.values()].sort((left, right) => {
    const leftLength = left.medoid.tokens.length * left.segments.length * left.meanSimilarity;
    const rightLength = right.medoid.tokens.length * right.segments.length * right.meanSimilarity;
    return rightLength - leftLength;
  });
  const selected: SegmentCluster[] = [];
  for (const candidate of ranked) {
    if (selected.some((existing) => occurrenceOverlap(existing, candidate) >= 0.7)) continue;
    selected.push(candidate);
    if (selected.length >= MAX_DETECTED_LOOPS) break;
  }
  return selected;
}

function alignToReference(reference: readonly LoopToken[], candidate: readonly LoopToken[]): SequenceAlignment {
  const rows = reference.length + 1;
  const columns = candidate.length + 1;
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  for (let column = 0; column < columns; column += 1) distance[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = reference[row - 1].key === candidate[column - 1].key ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitution
      );
    }
  }

  const matches: (LoopToken | null)[] = Array(reference.length).fill(null);
  const insertions: { slot: number; token: LoopToken }[] = [];
  let row = reference.length;
  let column = candidate.length;
  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      reference[row - 1].key === candidate[column - 1].key &&
      distance[row][column] === distance[row - 1][column - 1]
    ) {
      matches[row - 1] = candidate[column - 1];
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
      row -= 1;
      continue;
    }
    if (column > 0 && distance[row][column] === distance[row][column - 1] + 1) {
      insertions.push({ slot: row, token: candidate[column - 1] });
      column -= 1;
      continue;
    }
    if (row > 0 && column > 0) {
      insertions.push({ slot: row - 1, token: candidate[column - 1] });
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0) row -= 1;
    else if (column > 0) {
      insertions.push({ slot: 0, token: candidate[column - 1] });
      column -= 1;
    }
  }
  return { matches, insertions: insertions.reverse() };
}

function countRange(tokens: readonly (LoopToken | null)[]): { minimum: number; maximum: number } {
  const counts = tokens.filter((token): token is LoopToken => Boolean(token)).map((token) => token.count);
  return {
    minimum: counts.length ? Math.min(...counts) : 1,
    maximum: counts.length ? Math.max(...counts) : 1
  };
}

function tokenIconVariants(tokens: readonly LoopToken[]): string[] {
  return [
    ...new Set(tokens.flatMap((token) => token.actions.map((action) => action.icon).filter((icon) => Boolean(icon))))
  ];
}

function stepsUsuallyFollowImmediately(
  cluster: SegmentCluster,
  previous: RotationLoopStep,
  current: RotationLoopStep
): boolean {
  let eligible = 0;
  let linked = 0;
  for (const segment of cluster.segments) {
    const hasPrevious = segment.tokens.some((token) => token.key === previous.key);
    const hasCurrent = segment.tokens.some((token) => token.key === current.key);
    if (!hasPrevious || !hasCurrent) continue;
    eligible += 1;
    const adjacent = segment.tokens.some((token, index) => {
      const next = segment.tokens[index + 1];
      if (token.key !== previous.key || next?.key !== current.key) return false;
      const previousEnd = Math.max(...token.actions.map((action) => action.endMs));
      const currentStart = Math.min(...next.actions.map((action) => action.startMs));
      return currentStart - previousEnd <= 250;
    });
    if (adjacent) linked += 1;
  }
  return eligible > 0 && linked / eligible >= 0.85;
}

function consensusSteps(cluster: SegmentCluster): RotationLoopStep[] {
  const alignments = cluster.segments.map((segment) => alignToReference(cluster.medoid.tokens, segment.tokens));
  const ordered: OrderedConsensusStep[] = [];
  const referenceKeyFrequency = new Map<string, number>();
  for (const token of cluster.medoid.tokens) {
    referenceKeyFrequency.set(token.key, (referenceKeyFrequency.get(token.key) || 0) + 1);
  }
  cluster.medoid.tokens.forEach((referenceToken, referenceIndex) => {
    if (referenceToken.key.startsWith('auto-chain-fragment:')) return;
    const samples =
      referenceKeyFrequency.get(referenceToken.key) === 1
        ? cluster.segments.map((segment) => {
            const matchingTokens = segment.tokens.filter((token) => token.key === referenceToken.key);
            const first = matchingTokens[0];
            return first
              ? {
                  ...first,
                  count: matchingTokens.reduce((total, token) => total + token.count, 0),
                  actions: matchingTokens.flatMap((token) => token.actions)
                }
              : null;
          })
        : alignments.map((alignment) => alignment.matches[referenceIndex]);
    const matching = samples.filter((token): token is LoopToken => Boolean(token && token.key === referenceToken.key));
    const support = matching.length / cluster.segments.length;
    if (support < MIN_STEP_SUPPORT) return;
    const range = countRange(samples);
    ordered.push({
      slot: referenceIndex,
      insertion: false,
      step: {
        key: referenceToken.key,
        kind: referenceToken.kind,
        name: referenceToken.name,
        primarySkillId: referenceToken.primarySkillId,
        skillIds: referenceToken.skillIds,
        iconVariants: tokenIconVariants(matching),
        minimumCount: range.minimum,
        maximumCount: range.maximum,
        support,
        placement: support >= 0.75 ? 'fixed' : 'flexible',
        followsPreviousImmediately: false
      }
    });
  });

  const insertionsByKey = new Map<
    string,
    { readonly samples: Array<{ occurrence: number; slot: number; token: LoopToken }> }
  >();
  alignments.forEach((alignment, occurrence) => {
    for (const insertion of alignment.insertions) {
      if (insertion.token.key.startsWith('auto-chain-fragment:') || referenceKeyFrequency.has(insertion.token.key)) {
        continue;
      }
      const group = insertionsByKey.get(insertion.token.key) || { samples: [] };
      group.samples.push({ occurrence, slot: insertion.slot, token: insertion.token });
      insertionsByKey.set(insertion.token.key, group);
    }
  });
  for (const [key, group] of insertionsByKey) {
    const occurrenceCounts = new Map<number, number>();
    for (const sample of group.samples) {
      occurrenceCounts.set(sample.occurrence, (occurrenceCounts.get(sample.occurrence) || 0) + sample.token.count);
    }
    const support = occurrenceCounts.size / cluster.segments.length;
    if (support < MIN_STEP_SUPPORT) continue;
    const token = group.samples[0].token;
    const counts = [...occurrenceCounts.values()];
    ordered.push({
      slot: median(group.samples.map((sample) => sample.slot)),
      insertion: true,
      step: {
        key,
        kind: token.kind,
        name: token.name,
        primarySkillId: token.primarySkillId,
        skillIds: token.skillIds,
        iconVariants: tokenIconVariants(group.samples.map((sample) => sample.token)),
        minimumCount: Math.min(...counts),
        maximumCount: Math.max(...counts),
        support,
        placement: 'flexible',
        followsPreviousImmediately: false
      }
    });
  }

  const steps = ordered
    .sort((left, right) => left.slot - right.slot || Number(right.insertion) - Number(left.insertion))
    .map((entry) => entry.step);
  return steps.map((step, index) => ({
    ...step,
    followsPreviousImmediately: index > 0 && stepsUsuallyFollowImmediately(cluster, steps[index - 1], step)
  }));
}

/** Preserves the exact pre-loop sequence while collapsing repeated casts and complete autoattack chains for display. */
function fixedSequenceSteps(tokens: readonly LoopToken[]): RotationLoopStep[] {
  const visibleTokens = combineConsecutiveTokens(
    tokens.flatMap((token) =>
      token.key.startsWith('auto-chain-fragment:') ? token.actions.map(baseSkillToken) : [token]
    )
  );
  return visibleTokens.map((token, index) => {
    const previous = visibleTokens[index - 1];
    const previousEnd = previous ? Math.max(...previous.actions.map((action) => action.endMs)) : 0;
    const currentStart = Math.min(...token.actions.map((action) => action.startMs));
    return {
      key: token.key,
      kind: token.kind,
      name: token.name,
      primarySkillId: token.primarySkillId,
      skillIds: token.skillIds,
      iconVariants: tokenIconVariants([token]),
      minimumCount: token.count,
      maximumCount: token.count,
      support: 1,
      placement: 'fixed',
      followsPreviousImmediately: Boolean(previous && currentStart - previousEnd <= 250)
    };
  });
}

function loopConfidence(
  cluster: SegmentCluster,
  steps: readonly RotationLoopStep[]
): { score: number; label: RotationLoopConfidence } {
  const repetition = clamp01((cluster.segments.length - 1) / 3);
  const support = steps.length ? steps.reduce((total, step) => total + step.support, 0) / steps.length : 0;
  const boundary = cluster.boundaryDriven ? 1 : 0.7;
  const score = clamp01(cluster.meanSimilarity * 0.45 + repetition * 0.25 + support * 0.2 + boundary * 0.1);
  return {
    score,
    label: score >= 0.8 ? 'high' : score >= 0.62 ? 'medium' : 'low'
  };
}

function predictableBoundaryStep(step: RotationLoopStep): boolean {
  return (
    step.kind === 'skill' &&
    step.placement === 'fixed' &&
    step.support >= 0.75 &&
    step.minimumCount === 1 &&
    step.maximumCount === 1
  );
}

function usableGuideAnchor(step: RotationLoopStep): boolean {
  return (
    step.kind === 'skill' && step.support >= MIN_STEP_SUPPORT && step.minimumCount === 1 && step.maximumCount === 1
  );
}

function evenlySpacedIndexes(indexes: readonly number[], maximum: number): number[] {
  if (indexes.length <= maximum) return [...indexes];
  return [
    ...new Set(
      Array.from(
        { length: maximum },
        (_value, index) => indexes[Math.round((index * (indexes.length - 1)) / (maximum - 1))]
      )
    )
  ];
}

function boundaryGuideSteps(cluster: SegmentCluster): RotationLoopStep[] {
  const consensus = consensusSteps(cluster);
  const head: number[] = [];
  for (let index = 0; index < Math.min(consensus.length, MAX_BOUNDARY_ANCHOR_STEPS); index += 1) {
    if (!predictableBoundaryStep(consensus[index])) break;
    head.push(index);
  }

  const tail: number[] = [];
  for (
    let index = consensus.length - 1;
    index >= Math.max(0, consensus.length - MAX_BOUNDARY_ANCHOR_STEPS);
    index -= 1
  ) {
    if (!predictableBoundaryStep(consensus[index])) break;
    tail.unshift(index);
  }
  const boundaryIndexes = new Set([...head, ...tail]);
  const boundaryKeys = new Set([...boundaryIndexes].map((index) => consensus[index].key));
  const middle = consensus
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step, index }) => !boundaryIndexes.has(index) && predictableBoundaryStep(step) && boundaryKeys.has(step.key)
    )
    .slice(0, 2)
    .map(({ index }) => index);
  let selectedIndexes = [...new Set([...head, ...middle, ...tail])].sort((left, right) => left - right);
  if (selectedIndexes.length < MIN_LOOP_TOKENS) {
    // Highly variable priority rotations rarely have a fully stable prefix.
    // Sample reliable skills across the whole lane and make omitted regions explicit.
    selectedIndexes = evenlySpacedIndexes(
      consensus
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => usableGuideAnchor(step))
        .map(({ index }) => index),
      MAX_BOUNDARY_GUIDE_STEPS
    );
  }
  if (selectedIndexes.length < MIN_LOOP_TOKENS) return [];

  const steps: RotationLoopStep[] = [];
  selectedIndexes.forEach((sourceIndex, selectedIndex) => {
    const previousSourceIndex = selectedIndexes[selectedIndex - 1];
    if (selectedIndex > 0 && sourceIndex - previousSourceIndex > 1) {
      steps.push({
        key: `boundary-gap:${previousSourceIndex}:${sourceIndex}`,
        kind: 'gap',
        name: 'Variable actions',
        primarySkillId: '',
        skillIds: [],
        iconVariants: [],
        minimumCount: 1,
        maximumCount: 1,
        support: 0,
        placement: 'flexible',
        followsPreviousImmediately: false
      });
    }
    const step = consensus[sourceIndex];
    steps.push({
      ...step,
      followsPreviousImmediately: Boolean(
        selectedIndex > 0 && sourceIndex - previousSourceIndex === 1 && step.followsPreviousImmediately
      )
    });
  });
  return steps;
}

function detectedLoopFromSteps(
  cluster: SegmentCluster,
  index: number,
  steps: readonly RotationLoopStep[],
  confidence: { readonly score: number; readonly label: RotationLoopConfidence },
  mode: DetectedRotationLoop['mode']
): DetectedRotationLoop {
  const occurrences = [...cluster.segments]
    .sort((left, right) => left.actions[0].startMs - right.actions[0].startMs)
    .map((segment) => {
      const first = segment.actions[0];
      const last = segment.actions.at(-1) as NormalizedAction;
      return {
        startMs: first.startMs,
        endMs: last.endMs,
        durationMs: Math.max(0, last.endMs - first.startMs),
        rotationIndices: [
          ...new Set(
            segment.actions
              .map((action) => action.rotationIndex)
              .filter((rotationIndex): rotationIndex is number => rotationIndex != null)
          )
        ],
        editCount: sequenceEditDistance(cluster.medoid.tokens, segment.tokens)
      };
    });
  return {
    id: `rotation-loop-${index + 1}`,
    label: cluster.label,
    confidence: confidence.label,
    confidenceScore: confidence.score,
    consistency: cluster.meanSimilarity,
    mode,
    steps,
    occurrences,
    averageDurationMs: occurrences.reduce((total, occurrence) => total + occurrence.durationMs, 0) / occurrences.length
  };
}

function clusterToDetectedLoop(cluster: SegmentCluster, index: number): DetectedRotationLoop | null {
  const steps = consensusSteps(cluster);
  const minimumSteps = cluster.boundaryDriven ? MIN_STRUCTURAL_LOOP_TOKENS : MIN_LOOP_TOKENS;
  if (steps.length < minimumSteps) return null;
  const confidence = loopConfidence(cluster, steps);
  if (confidence.score < 0.55) return null;
  return detectedLoopFromSteps(cluster, index, steps, confidence, 'consensus');
}

function clusterToBoundaryGuide(cluster: SegmentCluster, index: number): DetectedRotationLoop | null {
  const steps = boundaryGuideSteps(cluster);
  if (steps.filter((step) => step.kind !== 'gap').length < MIN_LOOP_TOKENS) return null;
  const confidence = loopConfidence(
    cluster,
    steps.filter((step) => step.kind !== 'gap')
  );
  return detectedLoopFromSteps(
    cluster,
    index,
    steps,
    { score: Math.min(0.61, confidence.score), label: 'low' },
    'boundary-guide'
  );
}

function uniqueLoopLabels(loops: readonly DetectedRotationLoop[]): DetectedRotationLoop[] {
  const totals = new Map<string, number>();
  for (const loop of loops) totals.set(loop.label, (totals.get(loop.label) || 0) + 1);
  const ordinals = new Map<string, number>();
  return loops.map((loop) => {
    if ((totals.get(loop.label) || 0) < 2) return loop;
    const ordinal = (ordinals.get(loop.label) || 0) + 1;
    ordinals.set(loop.label, ordinal);
    return {
      ...loop,
      label: `${loop.label} ${String.fromCharCode(64 + ordinal)}`
    };
  });
}

function loopAnalysisBuildSignature(app: ProfessionAppState): string {
  return JSON.stringify({
    startingWeaponSet: app.build.startingWeaponSet,
    weapons: app.build.weapons,
    alternateWeapons: app.build.alternateWeapons,
    weaponSwapChangesSet: app.profession.ui.weaponSwapChangesSet,
    selectedLegends: app.build.selectedLegends,
    startingLegend: app.build.startingLegend
  });
}

/**
 * Summarizes repeated player-action blocks from the resolved simulation so the
 * Analysis view describes what actually executed, while tolerating cooldown drift.
 */
export function analyzeRotationLoops(app: ProfessionAppState): RotationLoopAnalysis {
  const result = app.results;
  const buildSignature = loopAnalysisBuildSignature(app);
  if (result) {
    const cached = analysisCache.get(result);
    if (cached?.catalog === app.activeCatalog && cached.buildSignature === buildSignature) {
      return cached.analysis;
    }
  }
  const actions = normalizedPlayerActions(app);
  if (actions.length < MIN_LOOP_TOKENS * 2) {
    const analysis = {
      loops: [],
      openerSteps: [],
      analyzedActionCount: actions.length,
      coveredActionCount: 0,
      openerActionCount: 0,
      trailingActionCount: 0
    };
    if (result) analysisCache.set(result, { catalog: app.activeCatalog, buildSignature, analysis });
    return analysis;
  }
  const autoattackChains = catalogAutoattackChains(app);
  const segments = structuralSegments(app, actions, autoattackChains);
  let detectedLoops: DetectedRotationLoop[] = [];
  if (segments.length) {
    const normalClusters = boundaryClusters(segments);
    const normalLoops = normalClusters
      .map(clusterToDetectedLoop)
      .filter((loop): loop is DetectedRotationLoop => Boolean(loop));
    const guideLoops = boundaryGuideClusters(segments)
      .map((cluster, index) => clusterToBoundaryGuide(cluster, normalLoops.length + index))
      .filter((loop): loop is DetectedRotationLoop => Boolean(loop));
    const guideByLabel = new Map(guideLoops.map((loop) => [loop.label, loop]));
    // Medium/low consensus tends to overstate variable middle actions. Prefer
    // a stable boundary guide for that lane, while high-confidence loops keep
    // their full inferred sequence.
    detectedLoops = normalLoops.map((loop) =>
      loop.confidence === 'high' ? loop : guideByLabel.get(loop.label) || loop
    );
    const resolvedLabels = new Set(detectedLoops.map((loop) => loop.label));
    detectedLoops.push(...guideLoops.filter((loop) => !resolvedLabels.has(loop.label)));
  }
  if (!detectedLoops.length) {
    const fallbackClusters = selectFallbackClusters([
      ...fallbackAnchorClusters(actions, autoattackChains),
      ...fallbackTandemClusters(actions, autoattackChains)
    ]);
    detectedLoops = fallbackClusters
      .map((cluster, index) => {
        const loop = clusterToDetectedLoop(cluster, index);
        if (!loop || loop.confidence === 'high') return loop;
        return clusterToBoundaryGuide(cluster, index) || loop;
      })
      .filter((loop): loop is DetectedRotationLoop => Boolean(loop));
  }
  const loops = uniqueLoopLabels(
    detectedLoops
      .sort((left, right) => left.occurrences[0].startMs - right.occurrences[0].startMs)
      .slice(0, MAX_DETECTED_LOOPS)
  );
  const covered = new Set<number>();
  for (const loop of loops) {
    for (const occurrence of loop.occurrences) {
      for (const action of actions) {
        if (action.startMs >= occurrence.startMs && action.endMs <= occurrence.endMs) {
          covered.add(action.sequenceIndex);
        }
      }
    }
  }
  const coveredIndexes = [...covered].sort((left, right) => left - right);
  const firstCovered = coveredIndexes[0] ?? actions.length;
  const lastCovered = coveredIndexes.at(-1) ?? -1;
  const openerActions = loops.length ? actions.slice(0, firstCovered) : [];
  const analysis = {
    loops,
    openerSteps: fixedSequenceSteps(tokenizeActions(openerActions, autoattackChains)),
    analyzedActionCount: actions.length,
    coveredActionCount: covered.size,
    openerActionCount: openerActions.length,
    trailingActionCount: loops.length ? Math.max(0, actions.length - lastCovered - 1) : 0
  };
  if (result) analysisCache.set(result, { catalog: app.activeCatalog, buildSignature, analysis });
  return analysis;
}
