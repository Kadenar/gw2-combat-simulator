import { inputKeyModifier, parseInputBinding } from '#gw2/input/bindings.js';
import { INPUT_KEY_POSITIONS } from '#gw2/input/keyboard-layout.js';
import { validateInputProfile, type InputProfile } from '#gw2/input/profile.js';
import type { InputAction } from '#gw2/platform/execution/input-controls.js';
import type { InputTrace } from '#gw2/platform/results/input-trace.js';
import { rankedInputWindows, type InputWindow } from '#gw2/platform/results/input-windows.js';
import type { InputControlId } from '#gw2/platform/skills/input-controls.js';

export type InputReach = 'near' | 'stretch' | 'far';

export interface AnalyzedInputAction {
  input: InputAction;
  binding: string | null;
  reach: InputReach | null;
  usesModifier: boolean;
  transition?: {
    from: { binding: string; control: InputControlId; rotationIndex: number };
    gap: number;
    /** Key-centre distance in key widths; null when either position is unknown. */
    distance: number | null;
    sameKey: boolean;
  };
}

export interface InputAnalysis {
  actions: AnalyzedInputAction[];
  windows: InputWindow[];
  reachCounts: Record<InputReach | 'unknown', number>;
  modifierActions: number;
  coverage: {
    actions: number;
    missing: { control: InputControlId | null; count: number }[];
  };
}

/** Descriptive WASD reach groups, not weights or a measure of execution difficulty. */
export function inputKeyReach(key: string): InputReach {
  if (
    /^(Mouse[1-5]|Key[QWERASDFZXCV]|Digit[1-4]|Space|Tab|Backquote|CapsLock|(?:Control|Alt|Shift)(?:Left|Right))$/.test(
      key
    )
  )
    return 'near';

  if (/^(Key[TGB]|Digit5|F[1-4])$/.test(key)) return 'stretch';

  return 'far';
}

/** Count every accepted action; bindings only describe reach and consecutive transitions, never change pace. */
export function analyzeInputTrace(trace: InputTrace, profile: InputProfile): InputAnalysis {
  const p = validateInputProfile(profile);
  const actions: AnalyzedInputAction[] = [];
  const reachCounts: InputAnalysis['reachCounts'] = { near: 0, stretch: 0, far: 0, unknown: 0 };
  let modifierActions = 0;
  const missing = new Map<string, InputAnalysis['coverage']['missing'][number]>();
  const inputs = [...trace.actions].sort((a, b) => a.at - b.at || a.order - b.order);
  for (const input of inputs) {
    const binding = input.control ? p.bindings[input.control] : '';
    const parsed = parseInputBinding(binding);
    const reach = parsed ? inputKeyReach(parsed.key) : null;
    const usesModifier = !!parsed && (parsed.modifiers.length > 0 || inputKeyModifier(parsed.key) != null);
    const action: AnalyzedInputAction = { input, binding: parsed ? binding : null, reach, usesModifier };
    reachCounts[reach ?? 'unknown']++;

    if (usesModifier) modifierActions++;

    if (!parsed) {
      const reason = input.control ? 'Binding is unresolved or unbound.' : input.unresolvedReason;
      const key = `${input.control}:${reason}`;
      // Reasons keep distinct missing-input groups separate; the view needs only their control and count.
      const item = missing.get(key) ?? { control: input.control, count: 0 };
      item.count++;
      missing.set(key, item);
    }

    // Only adjacent accepted inputs form a pair; an unmapped input must not create a fictitious jump across it.
    const previous = actions.at(-1);

    if (parsed && previous?.binding && previous.input.control) {
      const from = parseInputBinding(previous.binding)!;
      const first = INPUT_KEY_POSITIONS.get(from.key),
        second = INPUT_KEY_POSITIONS.get(parsed.key);
      action.transition = {
        from: {
          binding: previous.binding,
          control: previous.input.control,
          rotationIndex: previous.input.rotationIndex
        },
        gap: input.at - previous.input.at,
        distance: first && second ? Math.hypot(first[0] - second[0], first[1] - second[1]) : null,
        sameKey: from.key === parsed.key
      };
    }

    actions.push(action);
  }

  // Rank with the same rolling counts as APM, then keep separate nonempty sections.
  const windows = rankedInputWindows(trace, 5).filter((window) => window.count > 0);
  const selected: InputWindow[] = [];
  for (const window of windows) {
    if (selected.every((other) => window.end <= other.start || window.start >= other.end)) selected.push(window);

    if (selected.length === 3) break;
  }

  return {
    actions,
    windows: selected,
    reachCounts,
    modifierActions,
    coverage: {
      actions: inputs.length,
      missing: [...missing.values()]
    }
  };
}
