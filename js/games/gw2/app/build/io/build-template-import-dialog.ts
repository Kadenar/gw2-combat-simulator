import {
  applyBuildTemplatePreview,
  BuildTemplateProfessionMismatchError,
  previewBuildTemplateCode
} from './build-template-import.js';
import { errorMessage } from '../../../../../ui/shared/dom.js';

import type { BuildTemplateImportPreview } from './build-template-import.js';
import type { ProfessionAppState } from '../../types.js';

interface BuildTemplateDialogElements {
  readonly dialog: HTMLDialogElement;
  readonly code: HTMLTextAreaElement;
  readonly previewButton: HTMLButtonElement;
  readonly applyButton: HTMLButtonElement;
  readonly closeButtons: readonly HTMLButtonElement[];
  readonly error: HTMLElement;
  readonly switchProfession: HTMLAnchorElement;
  readonly preview: HTMLElement;
  readonly profession: HTMLElement;
  readonly weapons: HTMLElement;
  readonly weaponSelect: HTMLSelectElement;
  readonly specializations: HTMLElement;
  readonly skills: HTMLElement;
  readonly warnings: HTMLElement;
}

function ensureStyles(document: Document): void {
  if (document.getElementById('build-template-import-styles')) return;
  const style = document.createElement('style');
  style.id = 'build-template-import-styles';
  style.textContent = `
    .combat-loadout-title { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .combat-loadout-import { margin-left:auto; letter-spacing:normal; text-transform:none; }
    .build-template-import-dialog { position:fixed; inset:0; width:min(760px, calc(100vw - 28px));
      max-height:calc(100vh - 28px); margin:auto; padding:0; overflow:auto;
      border:1px solid var(--border-light); border-radius:12px; background:var(--bg-panel);
      color:var(--text); box-shadow:0 22px 80px rgba(0,0,0,.72); }
    .build-template-import-dialog::backdrop { background:rgba(3,6,12,.82); backdrop-filter:blur(3px); }
    .build-template-import-header { display:flex; align-items:flex-start; gap:18px; padding:20px 22px;
      text-align:left;
      border-bottom:1px solid var(--border); background:linear-gradient(135deg, rgba(102,170,255,.13), transparent 62%); }
    .build-template-import-eyebrow { margin:0 0 4px; color:var(--accent); font-size:10px;
      font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
    .build-template-import-header h3 { margin:0; color:var(--text-bright); font-size:20px; }
    .build-template-import-header p:last-child { margin:6px 0 0; color:var(--text-dim); font-size:12px; line-height:1.5; }
    .build-template-import-close { display:grid; width:32px; height:32px; margin-left:auto; padding:0; flex:0 0 32px;
      place-items:center; border:1px solid var(--border-light); border-radius:50%; background:var(--bg-panel-alt);
      color:var(--text-dim); font-size:20px; line-height:1; cursor:pointer; }
    .build-template-import-body { padding:20px 22px 22px; }
    .build-template-code-label { display:block; margin-bottom:7px; color:var(--text-bright); font-size:12px; font-weight:600; }
    .build-template-code { box-sizing:border-box; width:100%; min-height:88px; resize:vertical; padding:11px 12px;
      border:1px solid var(--border-light); border-radius:7px; background:var(--bg-panel-alt); color:var(--text-bright);
      font:11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap:anywhere; }
    .build-template-code:focus { outline:2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset:1px; }
    .build-template-preview-row { display:flex; justify-content:flex-end; margin-top:9px; }
    .build-template-import-error { margin:14px 0 0; padding:10px 12px; border:1px solid rgba(255,95,95,.45);
      border-radius:7px; background:rgba(255,70,70,.08); color:var(--condi); font-size:12px; line-height:1.5; }
    .build-template-switch-profession { display:inline-flex; margin-top:8px; color:var(--text-bright); }
    /* Present decoded choices as one joined panel so the imported build reads as a single unit. */
    .build-template-preview { margin-top:18px; overflow:hidden; border:1px solid var(--border-light);
      border-radius:9px; background:var(--bg-panel-alt); }
    .build-template-preview-hero { display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:14px 15px; border-bottom:1px solid var(--border);
      background:linear-gradient(135deg, transparent, rgba(102,170,255,.08)); }
    .build-template-preview-hero small { display:block; margin-bottom:3px; color:var(--text-dim); font-size:10px;
      letter-spacing:.08em; text-transform:uppercase; }
    .build-template-preview-profession { color:var(--text-bright); font-size:17px; font-weight:700; }
    .build-template-preview-weapons { color:var(--accent); font-size:13px; font-weight:600; text-align:right; }
    .build-template-preview-weapon-select { min-width:180px; padding:5px 8px; border:1px solid var(--border-light);
      border-radius:5px; background:var(--bg-panel-alt); color:var(--text-bright); font-size:12px; }
    .build-template-preview-grid { display:grid; grid-template-columns:minmax(0, .9fr) minmax(0, 1.1fr);
      gap:0; }
    .build-template-preview-card { padding:14px; }
    .build-template-preview-card + .build-template-preview-card { border-left:1px solid var(--border); }
    .build-template-preview-card h4 { margin:0 0 10px; color:var(--text-bright); font-size:11px;
      letter-spacing:.07em; text-transform:uppercase; }
    .build-template-preview-list { display:grid; gap:7px; }
    .build-template-preview-item { display:grid; grid-template-columns:28px minmax(0, 1fr); align-items:center; gap:8px;
      min-height:28px; color:var(--text); font-size:12px; }
    .build-template-preview-item img { width:28px; height:28px; border-radius:4px; object-fit:cover; }
    .build-template-preview-item-placeholder { width:28px; height:28px; border-radius:4px; background:var(--border); }
    .build-template-preview-item small { display:block; color:var(--text-dim); font-size:10px; }
    .build-template-import-warnings { margin:0; padding:10px 12px; border-top:1px solid #8b6a25;
      background:rgba(166,124,34,.09); color:#e0bd68; font-size:11px; line-height:1.5; white-space:pre-wrap; }
    .build-template-import-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:18px; padding-top:16px;
      border-top:1px solid var(--border); }
    .build-template-import-actions [data-build-template-apply]:disabled { opacity:.45; cursor:not-allowed; }
    @media (max-width:640px) { .build-template-preview-grid { grid-template-columns:1fr; }
      .build-template-preview-hero { align-items:flex-start; flex-direction:column; }
      .build-template-preview-card + .build-template-preview-card { border-top:1px solid var(--border); border-left:0; }
      .build-template-preview-weapons { text-align:left; } }
  `;
  document.head.append(style);
}

function required<T extends Element>(dialog: HTMLDialogElement, selector: string): T {
  const element = dialog.querySelector<T>(selector);
  if (!element) throw new Error('Build template dialog failed to initialize.');
  return element;
}

function createDialog(document: Document): BuildTemplateDialogElements {
  ensureStyles(document);
  const dialog = document.createElement('dialog');
  dialog.className = 'build-template-import-dialog';
  dialog.setAttribute('aria-labelledby', 'build-template-import-title');
  dialog.innerHTML = `<div class="build-template-import-shell">
    <header class="build-template-import-header">
      <div>
        <p class="build-template-import-eyebrow">In-game build import</p>
        <h3 id="build-template-import-title">Preview Guild Wars 2 build</h3>
      </div>
      <button type="button" class="build-template-import-close" data-build-template-close aria-label="Close">&times;</button>
    </header>
    <div class="build-template-import-body">
      <label class="build-template-code-label" for="build-template-code">Build chat code</label>
      <textarea id="build-template-code" class="build-template-code" data-build-template-code spellcheck="false" placeholder="[&amp;DQ...=]"></textarea>
      <div class="build-template-preview-row">
        <button type="button" class="btn btn-io" data-build-template-preview>Preview build</button>
      </div>
      <div class="build-template-import-error" role="alert" data-build-template-error hidden>
        <span data-build-template-error-message></span>
        <a class="build-template-switch-profession" data-build-template-switch hidden></a>
      </div>
      <section class="build-template-preview" data-build-template-result hidden aria-live="polite">
        <div class="build-template-preview-hero">
          <div><small>Profession</small><div class="build-template-preview-profession" data-build-template-profession></div></div>
          <div><small>Weapon set to apply</small>
            <div class="build-template-preview-weapons" data-build-template-weapons></div>
            <select class="build-template-preview-weapon-select" data-build-template-weapon-select aria-label="Weapon set to apply" hidden></select>
          </div>
        </div>
        <div class="build-template-preview-grid">
          <article class="build-template-preview-card">
            <h4>Specializations</h4>
            <div class="build-template-preview-list" data-build-template-specializations></div>
          </article>
          <article class="build-template-preview-card">
            <h4>Heal, utilities, and elite</h4>
            <div class="build-template-preview-list" data-build-template-skills></div>
          </article>
        </div>
        <p class="build-template-import-warnings" data-build-template-warnings hidden></p>
      </section>
      <footer class="build-template-import-actions">
        <button type="button" class="btn" data-build-template-close>Cancel</button>
        <button type="button" class="btn btn-io" data-build-template-apply disabled>Apply build</button>
      </footer>
    </div>
  </div>`;
  document.body.append(dialog);
  return {
    dialog,
    code: required(dialog, '[data-build-template-code]'),
    previewButton: required(dialog, '[data-build-template-preview]'),
    applyButton: required(dialog, '[data-build-template-apply]'),
    closeButtons: [...dialog.querySelectorAll<HTMLButtonElement>('[data-build-template-close]')],
    error: required(dialog, '[data-build-template-error]'),
    switchProfession: required(dialog, '[data-build-template-switch]'),
    preview: required(dialog, '[data-build-template-result]'),
    profession: required(dialog, '[data-build-template-profession]'),
    weapons: required(dialog, '[data-build-template-weapons]'),
    weaponSelect: required(dialog, '[data-build-template-weapon-select]'),
    specializations: required(dialog, '[data-build-template-specializations]'),
    skills: required(dialog, '[data-build-template-skills]'),
    warnings: required(dialog, '[data-build-template-warnings]')
  };
}

function previewItem(document: Document, label: string, detail: string, icon?: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'build-template-preview-item';
  const visual = icon ? document.createElement('img') : document.createElement('span');
  if (icon && visual instanceof HTMLImageElement) {
    visual.src = icon;
    visual.alt = '';
  } else {
    visual.className = 'build-template-preview-item-placeholder';
  }

  const copy = document.createElement('div');
  const name = document.createElement('span');
  const description = document.createElement('small');
  name.textContent = label;
  description.textContent = detail;
  copy.append(name, description);
  item.append(visual, copy);
  return item;
}

function renderPreview(
  app: ProfessionAppState,
  elements: BuildTemplateDialogElements,
  preview: BuildTemplateImportPreview
): void {
  const document = elements.dialog.ownerDocument;
  elements.profession.textContent = preview.professionName;
  const weaponLabel = (weapons: readonly string[]): string => weapons.filter(Boolean).join(' + ');
  elements.weaponSelect.replaceChildren(
    ...preview.weaponOptions.map((weapons, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = weaponLabel(weapons);
      return option;
    })
  );
  elements.weaponSelect.hidden = preview.weaponOptions.length <= 1;
  elements.weapons.hidden = preview.weaponOptions.length > 1;
  elements.weapons.textContent = preview.weapons ? weaponLabel(preview.weapons) : 'Keep current weapons';
  elements.specializations.replaceChildren(
    ...preview.specializations.map((selection) => {
      const specialization = app.activeCatalog.specializations.find((candidate) => candidate.name === selection.name);
      return previewItem(
        document,
        selection.name,
        `Traits ${selection.traits}`,
        typeof specialization?.icon === 'string' ? specialization.icon : undefined
      );
    })
  );
  const slotLabels: Readonly<Record<string, string>> = {
    Heal: 'Heal',
    Utility1: 'Utility 1',
    Utility2: 'Utility 2',
    Utility3: 'Utility 3',
    Elite: 'Elite'
  };
  elements.skills.replaceChildren(
    ...Object.entries(preview.selectedSkills).map(([slot, name]) => {
      const skill = app.activeCatalog.skillsByName.get(name);
      return previewItem(document, name, slotLabels[slot] || slot, skill?.icon);
    })
  );
  elements.warnings.hidden = preview.warnings.length === 0;
  elements.warnings.textContent = preview.warnings.join('\n');
  elements.preview.hidden = false;
}

/** Binds a modal, review-before-apply flow for in-game build chat codes. */
export function bindBuildTemplateImportDialog(app: ProfessionAppState, button: HTMLElement): void {
  button.setAttribute('aria-haspopup', 'dialog');
  const elements = createDialog(button.ownerDocument);
  let activePreview: BuildTemplateImportPreview | null = null;

  const clearResult = (): void => {
    activePreview = null;
    elements.applyButton.disabled = true;
    elements.preview.hidden = true;
    elements.error.hidden = true;
    elements.switchProfession.hidden = true;
  };

  const showError = (error: unknown): void => {
    activePreview = null;
    elements.applyButton.disabled = true;
    elements.preview.hidden = true;
    elements.error.hidden = false;
    required<HTMLElement>(elements.dialog, '[data-build-template-error-message]').textContent = errorMessage(error);
    if (error instanceof BuildTemplateProfessionMismatchError) {
      elements.switchProfession.hidden = false;
      elements.switchProfession.href = error.actualProfession.route;
      elements.switchProfession.textContent = `Open ${error.actualProfession.name} simulator`;
    } else {
      elements.switchProfession.hidden = true;
    }
  };

  const previewCode = (): void => {
    try {
      activePreview = previewBuildTemplateCode(app, elements.code.value);
      elements.error.hidden = true;
      elements.switchProfession.hidden = true;
      elements.applyButton.disabled = false;
      renderPreview(app, elements, activePreview);
    } catch (error) {
      showError(error);
    }
  };

  button.addEventListener('click', () => {
    elements.code.value = '';
    clearResult();
    elements.dialog.showModal();
    elements.code.focus();
  });
  elements.code.addEventListener('input', clearResult);
  elements.code.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      previewCode();
    }
  });
  elements.previewButton.addEventListener('click', previewCode);
  elements.applyButton.addEventListener('click', () => {
    if (!activePreview) return;
    const selectedWeapons = activePreview.weaponOptions[Number(elements.weaponSelect.value)] ?? activePreview.weapons;
    applyBuildTemplatePreview(app, activePreview, selectedWeapons);
    elements.dialog.close();
  });
  for (const closeButton of elements.closeButtons) {
    closeButton.addEventListener('click', () => elements.dialog.close());
  }

  elements.dialog.addEventListener('click', (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
}
