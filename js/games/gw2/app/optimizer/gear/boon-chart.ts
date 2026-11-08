/** Open a read-only chart for captured gear, cancel on dismissal, and cache a bounded number of previews per search. */
import { ManagedWorkerBatch } from '#browser/game/managed-worker-batch.js';
import { bindDialog, showDialog } from '#browser/page/dialog.js';
import type {
  OptimizerBoonChart,
  OptimizerBoonChartRequest,
  OptimizerBoonChartResponse
} from '#gw2/app/optimizer/gear/boon-chart-data.js';
import { optimizerEquipmentIdentity } from '#gw2/app/optimizer/gear/candidate-results.js';
import type { GearOptimizerRequest, OptimizerCandidate } from '#gw2/app/optimizer/gear/search.js';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';

const cache = new WeakMap<GearOptimizerRequest, Map<string, OptimizerBoonChart>>();
const dialogs = new WeakMap<Document, HTMLDialogElement>();

export function openOptimizerBoonChart(
  request: GearOptimizerRequest,
  candidate: OptimizerCandidate,
  trigger: HTMLElement
): void {
  const document = trigger.ownerDocument;
  dialogs.get(document)?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'optimizer-boon-dialog';
  dialog.setAttribute('aria-label', 'Ally boon chart');
  dialog.innerHTML = `<div class="app-dialog-body">
    <div class="optimizer-boon-heading"><h3>Ally boon chart</h3><button type="button" class="btn" data-dialog-close autofocus>Close</button></div>
    <p data-boon-status role="status">Simulating this result…</p>
    <div data-boon-chart></div>
  </div>`;
  const status = dialog.querySelector<HTMLElement>('[data-boon-status]')!;
  const chartContainer = dialog.querySelector<HTMLElement>('[data-boon-chart]')!;
  const batch = new ManagedWorkerBatch<OptimizerBoonChartResponse>();
  let disposeChart: (() => void) | undefined;
  let closed = false;
  let stopTracking = () => {};

  const key = optimizerEquipmentIdentity(candidate.equipment);
  const entries = cache.get(request) ?? new Map<string, OptimizerBoonChart>();

  cache.set(request, entries);
  const render = (chart: OptimizerBoonChart): void => {
    if (closed) return;

    status.textContent = '';
    disposeChart = mountTimeSeriesCharts(chartContainer, chart.series, {
      allyBoonsOnly: true,
      title: 'Quickness and alacrity',
      defaultVisibleEffectLimit: 2
    });
  };

  bindDialog(dialog);
  dialog.addEventListener(
    'close',
    () => {
      closed = true;
      batch.terminateAll();
      disposeChart?.();
      stopTracking();
      dialog.remove();

      if (dialogs.get(document) === dialog) dialogs.delete(document);

      if (trigger.isConnected) trigger.focus();
    },
    { once: true }
  );
  document.body.append(dialog);
  dialogs.set(document, dialog);
  stopTracking = showDialog(dialog);
  const cached = entries.get(key);

  if (cached) {
    render(cached);
    return;
  }

  batch.begin(1, (error) => {
    status.setAttribute('role', 'alert');
    status.textContent = `Unable to load the boon chart: ${String(error)}`;
  });
  batch.spawn(
    () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
    1,
    { kind: 'boon-chart', requestId: 1, request, equipment: candidate.equipment } satisfies OptimizerBoonChartRequest,
    (message, worker) => {
      batch.finish(worker);

      if (!('chart' in message) || closed) return;

      if (entries.size >= 20) entries.delete(entries.keys().next().value!);

      entries.set(key, message.chart);
      render(message.chart);
    }
  );
}
