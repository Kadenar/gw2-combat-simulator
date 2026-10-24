import { availableProcRateProfiles, normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface ProcRateControl {
  readonly id: string;
  readonly inputId: string;
  readonly label: string;
  readonly defaultChance: number;
  readonly opportunity: string;
}

/** Keep trait and equipment overrides in one saved map; clearing an input restores its current default. */
export function createProcRateControl(app: ProfessionAppState, control: ProcRateControl): HTMLLabelElement {
  const overrides = normalizeProcRateOverrides(app.build.assumptions.procRateOverrides);
  const defaultPercent = Number((control.defaultChance * 100).toFixed(4));
  const label = document.createElement('label');
  label.className = 'proc-rate-control';
  label.textContent = `${control.label} (%) `;
  label.title = `Chance per ${control.opportunity}. Leave blank to use the default: ${defaultPercent}%.`;
  const input = document.createElement('input');
  input.id = control.inputId;
  input.type = 'number';
  input.min = '0';
  input.max = '100';
  input.step = 'any';
  input.dataset.procRateId = control.id;
  input.placeholder = `${defaultPercent}%`;
  input.value = overrides[control.id] === undefined ? '' : String(Number((overrides[control.id] * 100).toFixed(4)));
  input.addEventListener('change', () => {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }

    const next = normalizeProcRateOverrides(app.build.assumptions.procRateOverrides);

    if (input.value === '') delete next[control.id];
    else next[control.id] = input.valueAsNumber / 100;

    app.build.assumptions.procRateOverrides = next;
    // Rerender all copies of an equipped sigil and invalidate the simulation together.
    const focused = document.activeElement === input;
    app.changed();

    if (focused) document.getElementById(control.inputId)?.focus();
  });
  label.append(input);
  return label;
}

/** Selected trait overrides live beneath Traits in both Live and Preview, retaining disclosure state on reruns. */
export function mountProcRateOverrides(app: ProfessionAppState): void {
  const traits = document.getElementById('traits-panel');

  if (!traits) return;

  const previous = document.querySelector<HTMLDetailsElement>('#trait-proc-rates');
  const profiles = availableProcRateProfiles(
    app.patch.catalog,
    (app.attributeData?.activeTraits || []).map((trait) => trait.id)
  );

  if (!profiles.length) {
    previous?.remove();
    return;
  }

  const section = document.createElement('details');
  section.id = 'trait-proc-rates';
  section.className = 'trait-proc-rates';
  section.open = previous?.open ?? false;
  const summary = document.createElement('summary');
  summary.textContent = 'Proc rate overrides';
  const controls = document.createElement('div');
  controls.className = 'proc-rate-controls';
  const description = document.createElement('p');
  description.textContent = 'Custom chance per eligible trigger. Leave blank to use the default.';
  controls.append(description);
  for (const profile of profiles) {
    const declaration = profile.procRate!;
    controls.append(
      createProcRateControl(app, {
        id: declaration.id,
        inputId: `proc-rate-${declaration.id}`,
        label: profile.name,
        defaultChance: Number(profile[declaration.field]),
        opportunity: declaration.opportunity
      })
    );
  }

  section.append(summary, controls);

  if (previous) previous.replaceWith(section);
  else traits.insertAdjacentElement('afterend', section);
}
