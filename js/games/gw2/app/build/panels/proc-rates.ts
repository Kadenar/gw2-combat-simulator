import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { availableProcRateProfiles, normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Render only active, opted-in traits using their runtime defaults; blank/reset inherits future balance changes. */
export function mountProcRateOverrides(app: ProfessionAppState, expanded = true): void {
  const container = document.getElementById('perma-boons');
  if (!container) return;
  const previous = container.querySelector<HTMLDetailsElement>('[data-assumption-section="proc-rates"]');
  previous?.remove();
  const config = {
    specialization: app.adapter.eliteSpecialization(app.build),
    patchId: app.patchId
  };
  const catalog = resolveProfessionRuntime(app.profession, config).catalog;
  const profiles = availableProcRateProfiles(
    catalog,
    (app.attributeData?.activeTraits || []).map((trait) => trait.id)
  );
  if (!profiles.length) return;
  const overrides = normalizeProcRateOverrides(app.build.assumptions.procRateOverrides);
  const section = document.createElement('details');
  section.className = 'perma-group';
  section.dataset.assumptionSection = 'proc-rates';
  section.open = expanded;
  const summary = document.createElement('summary');
  summary.className = 'perma-group-label';
  summary.textContent = 'Proc rate overrides';
  const controls = document.createElement('div');
  controls.className = 'perma-group-content';
  const description = document.createElement('p');
  description.textContent = 'Custom chance per eligible trigger. Leave blank to use the default.';
  controls.append(description);
  for (const profile of profiles) {
    const declaration = profile.procRate!;
    const defaultPercent = Number((Number(profile[declaration.field]) * 100).toFixed(4));
    const label = document.createElement('label');
    label.className = 'boon-control';
    label.textContent = `${profile.name} (%) `;
    label.title = `Chance per ${declaration.opportunity}. Default: ${defaultPercent}%.`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = 'any';
    input.dataset.procRateId = declaration.id;
    input.placeholder = `${defaultPercent}%`;
    input.value =
      overrides[declaration.id] === undefined ? '' : String(Number((overrides[declaration.id] * 100).toFixed(4)));
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn';
    reset.textContent = 'Reset';
    reset.setAttribute('aria-label', `Reset ${profile.name} proc rate`);
    reset.disabled = overrides[declaration.id] === undefined;
    const update = (): void => {
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }

      const next = normalizeProcRateOverrides(app.build.assumptions.procRateOverrides);
      if (input.value === '') delete next[declaration.id];
      else next[declaration.id] = input.valueAsNumber / 100;
      app.build.assumptions.procRateOverrides = next;
      reset.disabled = next[declaration.id] === undefined;
      // A build change invalidates worker results and any pinned rotation comparison together.
      app.changed();
    };

    input.addEventListener('change', update);
    reset.addEventListener('click', () => {
      input.value = '';
      update();
    });
    label.append(input);
    controls.append(label, reset);
  }

  section.append(summary, controls);
  container.append(section);
}
