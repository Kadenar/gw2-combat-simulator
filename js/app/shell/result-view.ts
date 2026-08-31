import { mountSimulationView } from '#ui/simulation-view.js';
import { updateFloatingDps } from '#app/shell/workspace.js';
import type { SimulationViewModel } from '#app/shell/types.js';

export interface SimulationRenderState {
  readonly inputRevision: number;
  readonly outputRevision: number;
}

// Before navigation mounts, the URL hash still identifies whether detailed Analysis is visible.
function analysisViewIsActive(): boolean {
  const body = document.body;
  if (!body) return true;
  const mountedView = body.dataset.simulatorView;
  if (mountedView) return mountedView === 'analysis';
  return document.defaultView?.location.hash === '#analysis';
}

/** Renders only shell-facing models; game resolver output never crosses this boundary. */
export function renderSimulationViewModel(viewModel: SimulationViewModel, state: SimulationRenderState): void {
  const summary = document.getElementById('rotation-dps-summary');
  const stale = state.outputRevision !== state.inputRevision;
  if (summary?.dataset) {
    summary.dataset.buildRevision = String(state.inputRevision);
    summary.dataset.resultRevision = String(state.outputRevision);
    summary.toggleAttribute?.('aria-busy', stale);
  }

  updateFloatingDps(viewModel.floatingDps);
  mountSimulationView(summary, viewModel.summary);

  const element = document.getElementById('rotation-results');
  if (!element) return;
  if (!analysisViewIsActive()) {
    if (element.dataset) element.dataset.analysisStale = 'true';
    if (viewModel.workspace) {
      mountSimulationView(element, viewModel.workspace);
    } else {
      element.innerHTML = '';
    }

    return;
  }

  if (element.dataset) delete element.dataset.analysisStale;
  if (!viewModel.analysis) {
    viewModel.onAnalysisEmpty?.(element);
    element.innerHTML = viewModel.analysisEmptyHtml || '';
    const mirror = document.getElementById('analysis-dps-summary');
    if (mirror) mirror.innerHTML = '';
    return;
  }

  mountSimulationView(element, viewModel.analysis);
  const mirror = document.getElementById('analysis-dps-summary');
  if (mirror) {
    mirror.innerHTML = '';
    const summaryContent = summary?.querySelector('.res-summary');
    if (summaryContent) mirror.appendChild(summaryContent.cloneNode(true));
  }

  viewModel.afterAnalysisRender?.(element);
}
