import type { SimulationViewModel } from '#ui/results/simulation-view.js';

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
