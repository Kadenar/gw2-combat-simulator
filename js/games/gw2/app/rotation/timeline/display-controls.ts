import { rotationDeadTimeVisibility, setRotationDeadTimeVisibility } from './size.js';
import { storeRotationProcOverlayVisibility } from './proc-overlays.js';
import type { ProfessionAppState } from '../../../../../app/profession/types.js';
import { renderTimeline } from './view.js';

const sectionOpenByApp = new WeakMap<ProfessionAppState, boolean>();

interface CheckboxControlOptions {
  readonly checked: boolean;
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly onChange: (checked: boolean) => void;
}

function checkboxControl(root: Document, options: CheckboxControlOptions): HTMLLabelElement {
  const control = root.createElement('label');
  control.className = 'boon-control';
  control.htmlFor = options.id;
  control.title = options.title;

  const checkbox = root.createElement('input');
  checkbox.id = options.id;
  checkbox.type = 'checkbox';
  checkbox.checked = options.checked;
  checkbox.addEventListener('change', () => options.onChange(checkbox.checked));

  control.append(checkbox, options.label);
  return control;
}

/** Places timeline-only preferences in Simulation Config while keeping them separate from simulation inputs. */
export function mountRotationDisplayControls(app: ProfessionAppState, root: Document = document): void {
  const container = root.getElementById('perma-boons');
  if (!container) return;

  container.querySelector('#rotation-display-controls')?.remove();

  const section = root.createElement('details');
  section.id = 'rotation-display-controls';
  section.className = 'perma-group';
  section.dataset.assumptionSection = 'timeline-display';
  section.open = sectionOpenByApp.get(app) ?? true;
  section.addEventListener('toggle', () => sectionOpenByApp.set(app, section.open));

  const summary = root.createElement('summary');
  summary.className = 'perma-group-label';
  summary.textContent = 'Timeline Display';

  const controls = root.createElement('div');
  controls.className = 'perma-group-content';
  controls.append(
    checkboxControl(root, {
      id: 'rotation-show-dead-time',
      label: 'Display idle time',
      title: 'Show time between skills when no skill cast is active',
      checked: rotationDeadTimeVisibility(root),
      onChange: (checked) => setRotationDeadTimeVisibility(root, checked)
    }),
    checkboxControl(root, {
      id: 'rotation-overlay-sigil-procs',
      label: 'Overlay sigils',
      title: 'Show sigil activations at their simulated positions in the rotation',
      checked: Boolean(app.overlaySigilProcs),
      onChange: (checked) => {
        app.overlaySigilProcs = checked;
        storeRotationProcOverlayVisibility(root, 'sigil', checked);
        renderTimeline(app);
      }
    }),
    checkboxControl(root, {
      id: 'rotation-overlay-relic-procs',
      label: 'Overlay relics',
      title: 'Show relic activations at their simulated positions in the rotation',
      checked: Boolean(app.overlayRelicProcs),
      onChange: (checked) => {
        app.overlayRelicProcs = checked;
        storeRotationProcOverlayVisibility(root, 'relic', checked);
        renderTimeline(app);
      }
    })
  );

  section.append(summary, controls);
  container.append(section);
}
