import type { AnalyzedInputAction, InputAnalysis, InputReach } from '#gw2/input/analysis.js';
import { INPUT_MODIFIER_CODES, parseInputBinding } from '#gw2/input/bindings.js';
import type { InputTrace } from '#gw2/platform/results/input-trace.js';
import type { InputWindow } from '#gw2/platform/results/input-windows.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';

export interface InputKeyRow {
  binding: string;
  controls: InputControlId[];
  count: number;
  /** Fraction of all accepted manual actions, including actions whose binding is unknown. */
  share: number;
  reach: InputReach;
  usesModifier: boolean;
  times: number[];
  rotationIndices: number[];
}

export interface InputTransitionRow {
  fromControls: InputControlId[];
  toControls: InputControlId[];
  fromBinding: string;
  toBinding: string;
  count: number;
  closestGap: number;
  medianGap: number;
  distance: number | null;
  sameKey: boolean;
  times: number[];
  /** Both ends of every occurrence, for timeline highlighting. */
  rotationIndices: number[];
}

export interface InputSection extends InputWindow {
  /** Only timeline identities are needed when a chart section is selected. */
  readonly rotationIndices: readonly number[];
}

export interface InputKeyUsage {
  readonly code: string;
  readonly count: number;
  readonly modifier: boolean;
}

export interface InputAnalysisSummary {
  readonly duration: number;
  readonly totalActions: number;
  readonly reachCounts: InputAnalysis['reachCounts'];
  readonly modifierActions: number;
  readonly keys: readonly InputKeyRow[];
  readonly transitions: readonly InputTransitionRow[];
  readonly sameInstantTransitions: number;
  readonly sections: readonly InputSection[];
  readonly keyUsage: ReadonlyMap<string, InputKeyUsage>;
  /** Actions per second in a full five-second window, shifted inward at rotation boundaries. */
  readonly samples: readonly { readonly at: number; readonly rate: number }[];
}

/** Group bindings by usage and adjacent binding pairs by median gap, without combining measurements into a score. */
export function summarizeInputAnalysis(trace: InputTrace, analysis: InputAnalysis): InputAnalysisSummary {
  const duration = Math.max(0, trace.end - trace.start);
  const totalActions = analysis.coverage.actions;
  const keys = new Map<string, InputKeyRow>();
  let sameInstantTransitions = 0;
  const pairs = new Map<string, InputTransitionRow & { gaps: number[] }>();
  for (const action of analysis.actions) {
    if (!action.binding || !action.input.control || !action.reach) continue;

    const row = keys.get(action.binding) ?? {
      binding: action.binding,
      controls: [],
      count: 0,
      share: 0,
      reach: action.reach,
      usesModifier: action.usesModifier,
      times: [],
      rotationIndices: []
    };

    if (!row.controls.includes(action.input.control)) row.controls.push(action.input.control);

    row.count++;
    row.share = row.count / totalActions;
    row.times.push(action.input.at - trace.start);
    row.rotationIndices.push(action.input.rotationIndex);
    keys.set(action.binding, row);
    const transition = action.transition;

    if (!transition) continue;

    // Same-tick commands have no measured separation; keep them out of movement timing ranks.
    if (transition.gap === 0) {
      sameInstantTransitions++;
      continue;
    }

    const id = `${transition.from.binding}>${action.binding}`;
    const pair = pairs.get(id) ?? {
      fromControls: [],
      toControls: [],
      fromBinding: transition.from.binding,
      toBinding: action.binding,
      count: 0,
      closestGap: transition.gap,
      medianGap: 0,
      distance: transition.distance,
      sameKey: transition.sameKey,
      times: [],
      rotationIndices: [],
      gaps: []
    };

    if (!pair.fromControls.includes(transition.from.control)) pair.fromControls.push(transition.from.control);

    if (!pair.toControls.includes(action.input.control)) pair.toControls.push(action.input.control);

    pair.count++;
    pair.closestGap = Math.min(pair.closestGap, transition.gap);
    pair.gaps.push(transition.gap);
    pair.times.push(action.input.at - trace.start);
    pair.rotationIndices.push(transition.from.rotationIndex, action.input.rotationIndex);
    pairs.set(id, pair);
  }

  const transitions = [...pairs.values()]
    .filter((row) => row.count >= 2)
    .map(({ gaps, ...row }) => {
      gaps.sort((a, b) => a - b);
      const middle = Math.floor(gaps.length / 2);
      row.medianGap = gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
      return row;
    })
    .sort(
      (a, b) =>
        a.medianGap - b.medianGap ||
        b.count - a.count ||
        a.fromBinding.localeCompare(b.fromBinding) ||
        a.toBinding.localeCompare(b.toBinding)
    );
  const sections = analysis.windows
    .map((window): InputSection => ({
      ...window,
      rotationIndices: analysis.actions
        .filter(
          ({ input }) =>
            input.at >= trace.start + window.start &&
            (input.at < trace.start + window.end || (window.end === duration && input.at === trace.end))
        )
        .map(({ input }) => input.rotationIndex)
    }))
    .sort((a, b) => a.start - b.start);
  const keyUsage = new Map<string, InputKeyUsage>();
  const use = (code: string, row: InputKeyRow, modifier: boolean): void => {
    const current = keyUsage.get(code);
    keyUsage.set(code, {
      code,
      count: (current?.count ?? 0) + row.count,
      modifier: (current?.modifier ?? false) || modifier
    });
  };

  for (const row of keys.values()) {
    const parsed = parseInputBinding(row.binding)!;
    use(parsed.key, row, false);
    for (const modifier of parsed.modifiers) use(INPUT_MODIFIER_CODES[modifier], row, true);
  }

  return {
    duration,
    totalActions,
    reachCounts: analysis.reachCounts,
    modifierActions: analysis.modifierActions,
    keys: [...keys.values()].sort((a, b) => b.count - a.count || a.binding.localeCompare(b.binding)),
    transitions,
    sameInstantTransitions,
    sections,
    keyUsage,
    samples: rollingPace(analysis.actions, trace.start, duration)
  };
}

/** Shift a full window inward at each edge so openers and endings use the same denominator as the middle. */
function rollingPace(
  actions: readonly AnalyzedInputAction[],
  start: number,
  duration: number
): { at: number; rate: number }[] {
  if (duration <= 0) return [];

  const windowSeconds = Math.min(5, duration);
  const steps = Math.min(600, Math.ceil(duration / 0.25));
  const samples: { at: number; rate: number }[] = [];
  let left = 0,
    right = 0;
  for (let index = 0; index <= steps; index++) {
    const at = (index * duration) / steps;
    const from = Math.max(0, Math.min(at - windowSeconds / 2, duration - windowSeconds)),
      to = from === duration - windowSeconds ? duration : from + windowSeconds;
    while (
      right < actions.length &&
      (actions[right].input.at - start < to || (to === duration && actions[right].input.at === start + duration))
    )
      right++;
    while (left < right && actions[left].input.at - start < from) left++;
    samples.push({ at, rate: (right - left) / windowSeconds });
  }

  return samples;
}
