export interface SimulationExtensionViewModel {
  readonly kind: 'extension';
  mount(container: HTMLElement): void;
}

export interface SimulationViewSection {
  readonly panels?: readonly SimulationExtensionViewModel[];
}

/** Shell-facing sections delegate their content to game-owned extension panels. */
export interface SimulationViewModel {
  readonly summary: SimulationViewSection;
  readonly workspace: SimulationViewSection | null;
  readonly analysis: SimulationViewSection | null;
  readonly headerDps?: string | null;
  readonly analysisEmptyHtml?: string;
  readonly onAnalysisEmpty?: (container: HTMLElement) => void;
  readonly afterAnalysisRender?: (container: HTMLElement) => void;
}

/** Clears stale content before mounting game-owned panels in section order. */
export function mountSimulationSection(container: HTMLElement | null | undefined, view: SimulationViewSection): void {
  if (!container) return;
  container.innerHTML = '';
  for (const panel of view.panels || []) panel.mount(container);
}
