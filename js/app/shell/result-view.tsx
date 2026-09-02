import { clearSimulationView, mountSimulationView } from '#ui/simulation-view.js';
import { renderReact } from '#ui/react-root.js';
import { updateFloatingDps } from '#app/shell/workspace.js';
import type { SimulationEmptyViewModel, SimulationViewModel } from '#ui/simulation-view.js';

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

/** Shows the framework-neutral empty state without handing React prebuilt HTML. */
function AnalysisEmpty({ model }: { model: SimulationEmptyViewModel }) {
  return (
    <div className='analysis-empty-state'>
      <strong>{model.title}</strong>
      <span>
        {model.message}
        {model.link ? <a href={model.link.href}>{model.link.label}</a> : null}
      </span>
    </div>
  );
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
    if (viewModel.workspace) mountSimulationView(element, viewModel.workspace);
    else clearSimulationView(element);
    return;
  }

  if (element.dataset) delete element.dataset.analysisStale;
  const mirror = document.getElementById('analysis-dps-summary');
  if (!viewModel.analysis) {
    if (viewModel.analysisEmpty) renderReact(element, <AnalysisEmpty model={viewModel.analysisEmpty} />);
    else clearSimulationView(element);
    clearSimulationView(mirror);
    viewModel.afterAnalysisRender?.();
    return;
  }

  mountSimulationView(element, viewModel.analysis);
  mountSimulationView(mirror, viewModel.summary);
  viewModel.afterAnalysisRender?.();
}
