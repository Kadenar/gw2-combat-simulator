import type { SimulationViewModel } from '#ui/simulation-view.js';

export type { SimulationViewModel, SimulationViewSection } from '#ui/simulation-view.js';

/** Stable address used by the shell, workers, and game registry. */
export interface GameContentAddress {
  readonly gameId: string;
  readonly contentId: string;
}

/** Game-neutral state the shell needs to coordinate input and output revisions. */
export interface ShellSession<TInput = unknown, TOutput = unknown> extends GameContentAddress {
  readonly input: TInput;
  readonly output: TOutput | null;
  readonly inputRevision: number;
  readonly outputRevision: number;
  readonly status: 'idle' | 'queued' | 'running' | 'error';
}

/** Lifecycle implemented by a game-owned session and invoked by the shared shell. */
export interface ShellLifecycle<TSession> {
  initialize(session: TSession): Promise<void>;
  change(session: TSession): void;
}

/** One game-supplied editor section; the shell only orders and invokes contributions. */
export interface BuildEditorContribution<TSession> {
  readonly id: string;
  render(session: TSession): void;
}

/** Complete game-supplied editor surface plus optional initialization hooks. */
export interface BuildEditor<TSession> {
  readonly sections: readonly BuildEditorContribution<TSession>[];
  initialize?(session: TSession): void | Promise<void>;
  bindControls?(session: TSession): void;
  updateSelection?(session: TSession): void;
}

/** Converts game output into a shell-facing view model and renders that model. */
export interface SimulationPresentation<TSession> {
  createViewModel(session: TSession): SimulationViewModel;
  render(session: TSession, viewModel: SimulationViewModel): void;
}
