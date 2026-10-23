import type { ProfessionAppState } from '#gw2/app/types.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import {
  canonicalAssumptionValue,
  displayAssumptionValue,
  previewAssumptionCounts,
  previewAssumptionGroups,
  type PreviewAssumptionGroup
} from '#gw2/app/patch-preview/assumptions-model.js';

/** Open the shared controls from either DPS surface without changing the selected game-data version. */
export function openPreviewAssumptions(root: Document = document): void {
  const panel = root.querySelector<HTMLDetailsElement>('#preview-assumptions');

  if (!panel) return;

  const reveal = () => {
    panel.open = true;
    panel.querySelector('summary')?.focus();
    panel.scrollIntoView({ block: 'start' });
  };

  // Results in Analysis link back to Traits in the workspace, after navigation restores its scroll position.
  if (root.body.dataset.simulatorView !== 'workspace') {
    root.querySelector<HTMLAnchorElement>('.simulator-view-tab[data-simulator-view="workspace"]')?.click();
    root.defaultView?.requestAnimationFrame(reveal);
  } else reveal();
}

/** A visible disclosure beside results distinguishes the shipped default model from user overrides. */
export function previewAssumptionNotice(app: ProfessionAppState): string {
  if (!app.profession?.preview || app.patch.id !== app.profession.preview.id) return '';

  const { total, custom } = previewAssumptionCounts(previewAssumptionGroups(app));
  return total
    ? `<button type="button" class="preview-assumption-link" data-preview-assumptions>Preview uses assumed values · ${custom ? `${custom} user override${custom === 1 ? '' : 's'}` : 'Preview defaults'}</button>`
    : '';
}

export function bindPreviewAssumptionNotice(container: HTMLElement): void {
  container.querySelector<HTMLButtonElement>('[data-preview-assumptions]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPreviewAssumptions(container.ownerDocument);
  });
}

/** Qualify Preview results while keeping all assumption controls and notices out of Live. */
export function mountPreviewAssumptionNotice(container: HTMLElement, app: ProfessionAppState): void {
  if (!app.profession?.preview || app.patch.id !== app.profession.preview.id) return;

  const markup = previewAssumptionNotice(app);

  if (!markup) return;

  const notice = container.ownerDocument.createElement('div');
  notice.className = 'preview-result-assumptions';
  notice.innerHTML = markup;
  bindPreviewAssumptionNotice(notice);
  container.append(notice);
}

/** Plain trait rows expose the editable values without repeating explanatory notes for every input. */
function assumptionGroupHtml(group: PreviewAssumptionGroup): string {
  return `<section class="preview-assumption-group" aria-label="${html(group.name)}">
    <h3>${html(group.name)}</h3>
    ${group.values
      .map(({ parameter, value }) => {
        const unit = parameter.unit === 's' ? 'seconds' : parameter.unit;
        const label = parameter.label.replace(`${group.name}: `, '');
        const id = `preview-value-${parameter.id}`;
        return `<div class="preview-assumption-value">
        <label for="${html(id)}">${html(label)}</label>
        <div class="preview-assumption-input"><input id="${html(id)}" type="number" data-preview-parameter="${html(parameter.id)}"
          aria-label="${html(`${parameter.label} (${unit})`)}"
          min="${displayAssumptionValue(parameter, parameter.minimum)}" max="${displayAssumptionValue(parameter, parameter.maximum)}"
          step="${Number((parameter.step * (parameter.unit === '%' ? 100 : 1)).toFixed(6))}"
          value="${displayAssumptionValue(parameter, value)}"><span>${html(unit)}</span></div>
      </div>`;
      })
      .join('')}
  </section>`;
}

/** Keep uncertainty directly beneath Traits, preserving disclosures across build edits and reruns. */
export function mountPreviewAssumptions(app: ProfessionAppState, root: Document = document): void {
  const traits = root.getElementById('traits-panel');

  if (!traits) return;

  const previous = root.querySelector<HTMLDetailsElement>('#preview-assumptions');

  if (!app.profession.preview || app.patch.id !== app.profession.preview.id) {
    previous?.remove();
    return;
  }

  const groups = previewAssumptionGroups(app);

  if (!groups.length) {
    previous?.remove();
    return;
  }

  const preview = app.profession.preview!;
  const equipped = groups.filter((group) => group.selected);
  const other = groups.filter((group) => !group.selected);
  const panel = root.createElement('details');
  panel.id = 'preview-assumptions';
  panel.className = 'preview-assumptions';
  panel.open = previous?.open ?? false;
  panel.innerHTML = `<summary><strong>Preview assumptions</strong></summary>
    <div class="preview-assumptions-content">
      <div class="preview-assumption-groups">${equipped.map(assumptionGroupHtml).join('')}</div>
      ${
        other.length
          ? `<details class="preview-other-assumptions"${previous?.querySelector<HTMLDetailsElement>('.preview-other-assumptions')?.open ? ' open' : ''}>
        <summary>Other traits (${other.length})</summary>
        <div class="preview-assumption-groups">${other.map(assumptionGroupHtml).join('')}</div></details>`
          : ''
      }
      <button type="button" class="btn" data-reset-preview-assumptions>Reset to preview defaults</button>
    </div>`;

  // UI values are converted once at the boundary; all simulation consumers keep canonical balance units.
  panel.querySelectorAll<HTMLInputElement>('[data-preview-parameter]').forEach((input) => {
    const control = groups
      .flatMap((group) => group.values)
      .find(({ parameter }) => parameter.id === input.dataset.previewParameter)!;
    input.addEventListener('change', () => {
      if (!input.value.trim() || !input.checkValidity()) {
        input.reportValidity();
        return;
      }

      const value = canonicalAssumptionValue(control.parameter, input.valueAsNumber);
      const values = { ...app.patch.values };

      if (value === control.defaultValue) delete values[control.parameter.id];
      else values[control.parameter.id] = value;

      app.patch = app.profession.resolvePatch({ id: preview.id, values });
      app.changed();
      root.getElementById(input.id)?.focus();
    });
  });
  panel.querySelector<HTMLButtonElement>('[data-reset-preview-assumptions]')!.addEventListener('click', () => {
    app.patch = app.profession.resolvePatch({ id: preview.id });
    app.changed();
    root.querySelector<HTMLButtonElement>('[data-reset-preview-assumptions]')?.focus();
  });

  if (previous) previous.replaceWith(panel);
  else traits.insertAdjacentElement('afterend', panel);
}
