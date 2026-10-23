import { mountResultSummary } from '#gw2/app/results/summary-view.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { escapeHtml as h } from '#ui/shared/html.js';
import { downloadJson } from '#gw2/app/import-export/files.js';
import { SIMULATOR_VIEW_CHANGE_EVENT } from '#gw2/app/page/navigation.js';
import { ENCOUNTER_TEMPLATES, encounterHealth, encounterDifficulties } from '#gw2/app/boss-scenarios/catalog.js';
import {
  createBossScenario,
  parseBossScenario,
  selectScenarioEncounter,
  type BossScenarioDraft
} from '#gw2/app/boss-scenarios/model.js';
import { encounterPhasePlan, type EncounterDifficulty } from '#gw2/app/boss-scenarios/phases.js';
import { createScenarioEditor } from '#gw2/app/boss-scenarios/editor.js';

const modeNames = { normal: 'Normal', challenge: 'Challenge', legendary: 'Legendary challenge' };
const format = (value: number | null): string => (value === null ? 'Unavailable' : value.toLocaleString('en-US'));
const button = (action: string, label: string, disabled = false): string =>
  `<button type="button" class="btn btn-io" data-boss-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;

/** Bosses opens directly into encounter inputs around the existing gear editor and continuous rotation builder. */
export function mountBossScenarios(app: ProfessionAppState): void {
  const host = document.getElementById('app');

  if (!host || document.getElementById('boss-workspace')) return;

  const workspace = document.createElement('section');
  workspace.id = 'boss-workspace';
  workspace.className = 'boss-workspace';
  workspace.setAttribute('aria-label', 'Boss encounter setup');
  const toolbar = document.createElement('div');
  toolbar.id = 'boss-scenario-toolbar';
  toolbar.className = 'boss-toolbar';
  host.querySelector('header')!.append(toolbar);
  const analysis = document.createElement('section');
  analysis.id = 'boss-analysis';
  analysis.className = 'boss-workspace';
  analysis.innerHTML =
    '<h2>Boss analysis</h2><p>Encounter simulation pending.</p><a href="#bosses">Return to Bosses</a>';
  host.append(analysis);
  const metrics = document.createElement('div');
  metrics.id = 'boss-encounter-summary';
  metrics.className = 'rotation-dps-summary';
  metrics.setAttribute('aria-label', 'Encounter metrics');
  document.getElementById('rotation-dps-summary')!.after(metrics);
  // Encounter assumptions live beside their results, below the shared rotation's DPS strip.
  metrics.after(workspace);

  // Version 2 owns a continuous rotation. Previous prototype documents are left untouched in their own storage.
  const storageKey = `gw2-boss-scenarios-${app.contentId}-v2`;
  let scenarios: BossScenarioDraft[] = [];
  let activeId = '';
  let message = '';
  let storageBlocked = false;
  const active = () => scenarios.find((draft) => draft.id === activeId);
  const parse = (value: unknown): BossScenarioDraft => {
    const patchId = (value as Partial<BossScenarioDraft> | null)?.patchId;

    if (typeof patchId !== 'string') throw new Error('A scenario must specify its game-data patch.');

    return parseBossScenario(
      value,
      app.adapter.id,
      app.adapter.toApplicationBuild,
      app.profession.resolvePatch({ id: patchId }).catalog
    );
  };

  try {
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      const saved = JSON.parse(raw);

      if (saved?.version !== 2 || !Array.isArray(saved.scenarios) || saved.scenarios.length > 100)
        throw new Error('Invalid scenario library.');

      scenarios = saved.scenarios.map(parse);

      if (
        new Set(scenarios.map((draft) => draft.id)).size !== scenarios.length ||
        (scenarios.length && !scenarios.some((draft) => draft.id === saved.activeId))
      )
        throw new Error('Invalid scenario selection.');

      activeId = saved.activeId;
    }
  } catch {
    scenarios = [];
    storageBlocked = true;
    message = 'Saved scenarios could not be read. Export new work before leaving; existing storage is preserved.';
  }

  const save = (): void => {
    if (storageBlocked) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 2, activeId, scenarios }));
    } catch {
      message = 'Could not save. Export this scenario before leaving.';
    }
  };

  const editor = createScenarioEditor(app, save);
  const mutate = (edit: (draft: BossScenarioDraft) => void): void => {
    const current = active();

    if (!current) return;

    editor.capture();
    const candidate = structuredClone(current);
    edit(candidate);
    Object.assign(current, parse(candidate));
    save();
  };

  const newDraft = (): void => {
    if (scenarios.length >= 100) throw new Error('The scenario library is full (100 drafts).');

    editor.capture();
    const source = editor.golem.tabs.find((tab) => tab.id === editor.golem.activeTabId)!;
    const draft = createBossScenario(
      active()?.encounterId ?? ENCOUNTER_TEMPLATES[0]!.id,
      source.build,
      source.name,
      source.patchId,
      true
    );
    scenarios.push(draft);
    activeId = draft.id;
    save();
  };

  const encounterOptions = (id: string): string =>
    [...new Set(ENCOUNTER_TEMPLATES.map((entry) => entry.group))]
      .map(
        (group) =>
          `<optgroup label="${h(group)}">${ENCOUNTER_TEMPLATES.filter((entry) => entry.group === group)
            .map(
              (entry) => `<option value="${entry.id}" ${entry.id === id ? 'selected' : ''}>${h(entry.name)}</option>`
            )
            .join('')}</optgroup>`
      )
      .join('');

  function render(preserveControls = false): void {
    const ownsEditor = document.body.dataset.analysisWorkspace === 'bosses';

    // The first visit creates a usable default immediately; later visits restore the selected saved encounter.
    if (ownsEditor && !active()) newDraft();

    const draft = active();
    document.body.dataset.bossEditorReady = String(Boolean(draft));

    if (ownsEditor && draft) editor.open(draft);
    else editor.close();

    if (!draft) return;

    const plan = encounterPhasePlan(draft.encounterId, draft.difficulty);
    const evidence = encounterHealth(draft.encounterId, draft.difficulty);
    const first = plan.phases[0]!;
    const segmented = evidence?.targets.find((entry) => entry.index === draft.targetIndex)?.healthBars?.length;
    metrics.replaceChildren();
    mountResultSummary(metrics, {
      metrics: [
        { label: 'Target total health', value: format(draft.health) },
        {
          label: 'First transition',
          value:
            first.kind === 'split'
              ? first.label
              : first.endHealthPercent === null
                ? 'Mechanic'
                : first.endHealthPercent === 0
                  ? 'Target defeated'
                  : `${first.endHealthPercent}% HP`
        },
        {
          label: 'Damage to first transition',
          value:
            first.kind === 'split' || first.endHealthPercent === null || segmented
              ? 'Pending'
              : format(draft.health === null ? null : Math.ceil(draft.health * (1 - first.endHealthPercent / 100)))
        },
        { label: 'Current HP / time to threshold', value: 'Pending' },
        { label: 'Phase DPS / overall DPS', value: 'Pending' }
      ]
    });

    if (evidence) {
      const link = document.createElement('a');
      link.href = evidence.report;
      link.textContent = 'EI';
      link.className = 'res-label';
      link.setAttribute('aria-label', 'Elite Insights health source');
      link.target = '_blank';
      link.rel = 'noreferrer';
      metrics.querySelector('.res-label-row')!.append(link);
    }

    if (preserveControls) {
      workspace.querySelector('.boss-message')!.textContent = message;
      return;
    }

    // Scenario selection uses automatic encounter names without a separate naming workflow.
    toolbar.innerHTML = `<select id="boss-scenario-select" aria-label="Boss scenario">${scenarios.map((entry) => `<option value="${h(entry.id)}" ${entry.id === activeId ? 'selected' : ''}>${h(entry.name)}</option>`).join('')}</select>
      ${button('new', 'New')}${button('duplicate', 'Duplicate')}${button('close', 'Close')}${button('export', 'Export')}${button('import', 'Import')}<input type="file" id="boss-file" accept=".json,application/json" hidden>`;
    const modes = encounterDifficulties(draft.encounterId);
    let bossIndex = 0;
    let splitIndex = 0;
    workspace.innerHTML = `<p class="boss-message" role="status">${h(message)}</p><div class="boss-setup">
      <div class="boss-fields"><label>Boss<select id="boss-encounter">${encounterOptions(draft.encounterId)}</select></label>${modes.length > 1 ? `<label>Difficulty<select id="boss-mode">${modes.map((mode) => `<option value="${mode}" ${mode === draft.difficulty ? 'selected' : ''}>${modeNames[mode]}</option>`).join('')}</select></label>` : ''}</div>
      <div class="boss-phase-inputs" aria-label="Encounter phases">${draft.phases
        .map((phase, index) => {
          const definition = plan.phases[index]!;
          return phase.kind === 'boss'
            ? `<label class="boss-phase-input"><span>Phase ${++bossIndex} DPS</span><small>${h(definition.label)}</small><input type="number" data-phase-input="${h(phase.id)}" aria-label="Phase ${bossIndex} group DPS excluding you" min="0" max="1000000000" step="1000" value="${phase.groupDps}"></label>`
            : `<label class="boss-phase-input boss-split-input"><span>Split ${++splitIndex} (seconds)</span><small>${h(definition.label)}</small><input type="number" data-phase-input="${h(phase.id)}" aria-label="Split ${splitIndex} duration in seconds" min="0" max="86400" step="0.1" placeholder="Seconds" value="${phase.durationSeconds ?? ''}"></label>`;
        })
        .join('')}</div>${plan.repeats ? '<small class="boss-muted">Repeating mechanic cycle</small>' : ''}
      <small class="boss-muted">Group DPS excludes you.</small></div>`;
  }

  const handle = (operation: () => void, preserveControls = false): void => {
    if (!storageBlocked) message = '';

    try {
      operation();
    } catch (error) {
      message = error instanceof Error ? error.message : 'Could not update the scenario.';
    }

    render(preserveControls);
  };

  toolbar.addEventListener('click', (event) => {
    const action =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-boss-action]')?.dataset.bossAction
        : undefined;

    if (!action) return;

    if (action === 'import') {
      toolbar.querySelector<HTMLInputElement>('#boss-file')!.click();
      return;
    }

    handle(() => {
      editor.capture();

      if (action === 'new') {
        newDraft();
        return;
      }

      const draft = active()!;

      // Closing removes the saved draft and selects a neighbor; the last closure gets a fresh default.
      if (action === 'close') {
        const index = scenarios.indexOf(draft);
        editor.discard(draft.id);
        scenarios.splice(index, 1);
        activeId = scenarios[Math.min(index, scenarios.length - 1)]?.id ?? '';

        if (!activeId) newDraft();
        else save();

        return;
      }

      if (action === 'export') {
        downloadJson(`${draft.name}.json`, draft);
        return;
      }

      if (action === 'duplicate') {
        if (scenarios.length >= 100) throw new Error('The scenario library is full (100 drafts).');

        const copy = structuredClone(draft);
        copy.id = crypto.randomUUID();
        copy.name = `${copy.name.slice(0, 150)} copy`;
        scenarios.push(copy);
        activeId = copy.id;
        save();
      }
    });
  });
  workspace.addEventListener('change', (event) => {
    const control = event.target;

    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;

    handle(
      () =>
        mutate((draft) => {
          if (control.id === 'boss-encounter' || control.id === 'boss-mode') {
            selectScenarioEncounter(
              draft,
              control.id === 'boss-encounter' ? control.value : draft.encounterId,
              control.id === 'boss-mode' ? (control.value as EncounterDifficulty) : 'normal'
            );

            draft.name = `${draft.encounter} scenario`;
          } else if (control.dataset.phaseInput) {
            const phase = draft.phases.find((entry) => entry.id === control.dataset.phaseInput)!;

            if (phase.kind === 'boss') phase.groupDps = Number(control.value);
            else phase.durationSeconds = control.value === '' ? null : Number(control.value);
          }
        }),
      control instanceof HTMLInputElement
    );
  });
  toolbar.addEventListener('change', async (event) => {
    const control = event.target;

    if (control instanceof HTMLSelectElement && control.id === 'boss-scenario-select')
      handle(() => {
        editor.capture();
        activeId = control.value;
        save();
      });

    if (!(control instanceof HTMLInputElement) || control.id !== 'boss-file' || !control.files?.[0]) return;

    const file = control.files[0];
    try {
      if (file.size > 5_000_000) throw new Error('Scenario files must be smaller than 5 MB.');

      const imported = parse(JSON.parse(await file.text()));
      handle(() => {
        if (scenarios.length >= 100) throw new Error('The scenario library is full (100 drafts).');

        editor.capture();
        imported.id = crypto.randomUUID();
        scenarios.push(imported);
        activeId = imported.id;
        save();
      });
    } catch (error) {
      handle(() => {
        throw error;
      });
    }
  });
  document.addEventListener(SIMULATOR_VIEW_CHANGE_EVENT, () => render());
  render();
}
