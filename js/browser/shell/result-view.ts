import { updateDpsStatus } from '#browser/shell/dps-status.js';
import { mountSimulationSection, type SimulationViewModel } from '#ui/results/simulation-view.js';

export interface SimulationRenderState {
  readonly inputRevision: number;
  readonly outputRevision: number;
  readonly analysisVisible: boolean;
}

/** Renders only shell-facing models; game resolver output never crosses this boundary. */
export function renderSimulationViewModel(viewModel: SimulationViewModel, state: SimulationRenderState): void {
  const summary = document.getElementById('rotation-dps-summary');
  const stale = state.outputRevision !== state.inputRevision;

  if (summary?.dataset) {
    summary.dataset.buildRevision = String(state.inputRevision);
    summary.dataset.resultRevision = String(state.outputRevision);
    // ARIA needs explicit boolean tokens to expose pending results to assistive technology.
    summary.setAttribute('aria-busy', String(stale));
  }

  updateDpsStatus(viewModel.headerDps);
  mountSimulationSection(summary, viewModel.summary);

  const element = document.getElementById('rotation-results');

  if (!element) return;

  // Navigation supplies visibility so the shell does not interpret game-owned routes.
  if (!state.analysisVisible) {
    if (element.dataset) element.dataset.analysisStale = 'true';

    if (viewModel.workspace) {
      mountSimulationSection(element, viewModel.workspace);
    } else {
      element.innerHTML = '';
    }

    return;
  }

  if (element.dataset) delete element.dataset.analysisStale;

  if (!viewModel.analysis) {
    element.innerHTML = viewModel.analysisEmptyHtml || '';
    const mirror = document.getElementById('analysis-dps-summary');

    if (mirror) mirror.innerHTML = '';

    return;
  }

  mountSimulationSection(element, viewModel.analysis);
  const mirror = document.getElementById('analysis-dps-summary');

  if (mirror) {
    mirror.innerHTML = '';
    const summaryContent = summary?.querySelector('.res-summary');

    if (summaryContent) mirror.appendChild(summaryContent.cloneNode(true));
  }

  viewModel.afterAnalysisRender?.(element);
}
