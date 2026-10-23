import { scenarioSimulation, ENCOUNTER_RESULT_EVENT } from '#gw2/app/boss-scenarios/simulation.js';
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
    '<h2>Boss analysis</h2><p>Detailed boss analysis is not implemented yet. Encounter totals are shown in the rotation builder.</p><a href="#bosses">Return to Bosses</a>';
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

  // Keep the native popover mounted so closing a row preserves the open selector and keyboard focus.
  toolbar.innerHTML = `<button type="button" id="boss-scenario-select" class="build-switcher" popovertarget="boss-scenario-menu" aria-label="Boss scenario">
    <span class="build-switcher-text"><span class="build-switcher-name"></span><span class="build-switcher-count"></span></span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button><div id="boss-scenario-menu" class="build-toolbar-menu build-switcher-menu" popover="auto" role="group" aria-label="Open scenarios">
    <div class="build-menu-heading">Open scenarios</div><div class="build-tab-list"></div></div>
    ${button('new', 'New')}${button('duplicate', 'Duplicate')}<input type="file" id="boss-file" accept=".json,application/json" hidden>`;
  const selector = toolbar.querySelector<HTMLButtonElement>('#boss-scenario-select')!;
  const menu = toolbar.querySelector<HTMLElement>('#boss-scenario-menu')!;
  const fileInput = toolbar.querySelector<HTMLInputElement>('#boss-file')!;
  menu.addEventListener('toggle', () => {
    if (!menu.matches(':popover-open')) return;

    const bounds = selector.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;
    const selected = menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
    selected?.focus({ preventScroll: true });
  });
  const editor = createScenarioEditor(app, save, {
    export: () =>
      handle(() => {
        editor.capture();
        const draft = active()!;
        downloadJson(`${draft.name}.json`, draft);
      }, true),
    import: () => fileInput.click()
  });
  const mutate = (edit: (draft: BossScenarioDraft) => void): void => {
    const current = active();

    if (!current) return;

    editor.capture();
    const candidate = structuredClone(current);
    edit(candidate);
    Object.assign(current, parse(candidate));
    save();
    app.changed(false);
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
    const execution = scenarioSimulation(draft);
    const result =
      app.workspace?.scenario === draft && app.resultRevision === app.buildRevision
        ? app.results?.encounter
        : undefined;
    const seconds = (value: number | null) => (value === null ? 'No damage rate' : `${value.toFixed(1)}s`);
    const number = (value: number) => Math.round(value).toLocaleString('en-US');
    metrics.replaceChildren();
    mountResultSummary(metrics, {
      metrics: [
        { label: 'Target total health', value: format(draft.health) },
        {
          label: 'Next transition',
          value: result
            ? result.defeated
              ? 'Target defeated'
              : result.phaseKind === 'split'
                ? 'Split ends'
                : `${result.nextHealthPercent}% HP`
            : first.kind === 'split'
              ? first.label
              : first.endHealthPercent === null
                ? 'Mechanic'
                : first.endHealthPercent === 0
                  ? 'Target defeated'
                  : `${first.endHealthPercent}% HP`
        },
        {
          label: 'Damage to next transition',
          value: result
            ? number(result.damageToTransition)
            : first.kind === 'split' || first.endHealthPercent === null || segmented
              ? 'Pending'
              : format(draft.health === null ? null : Math.ceil(draft.health * (1 - first.endHealthPercent / 100)))
        },
        {
          label: 'Current HP / estimated time to transition',
          value: result
            ? `${number(result.remainingHealth)} / ${seconds(result.timeToTransition)}`
            : execution.config
              ? 'Calculating'
              : 'Unavailable'
        },
        {
          label: 'Your phase DPS / overall DPS',
          value: result
            ? `${number(result.phaseDps)} / ${number(result.overallDps)}`
            : execution.config
              ? 'Calculating'
              : 'Unavailable'
        }
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

    const refreshPhaseResults = () => {
      for (const node of workspace.querySelectorAll<HTMLElement>('[data-phase-result]')) {
        const row = result?.phases.find((phase) => phase.id === node.dataset.phaseResult);
        node.textContent = row
          ? row.kind === 'boss'
            ? `Your DPS: ${number(row.dps)}`
            : `Elapsed: ${seconds(Math.max(0, (row.end ?? app.results!.combatEndTime) - row.start))}`
          : '';
      }
    };

    if (preserveControls) {
      refreshPhaseResults();
      workspace.querySelector('.boss-message')!.textContent = message || execution.reason;
      return;
    }

    selector.title = draft.name;
    selector.querySelector('.build-switcher-name')!.textContent = draft.name;
    selector.querySelector('.build-switcher-count')!.textContent =
      `${scenarios.length} open scenario${scenarios.length === 1 ? '' : 's'}`;
    menu.querySelector('.build-tab-list')!.innerHTML = scenarios
      .map((entry) => {
        const selected = entry.id === activeId;
        return `<div class="build-tab${selected ? ' is-active' : ''}">
        <button type="button" class="boss-scenario-option" data-boss-action="select" data-scenario-id="${h(entry.id)}" aria-pressed="${selected}" title="${h(entry.name)}">
        <svg class="build-tab-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg><span>${h(entry.name)}</span></button>
        <button type="button" class="build-tab-close" data-boss-action="close" data-scenario-id="${h(entry.id)}" aria-label="Close ${h(entry.name)}" title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
      })
      .join('');
    const modes = encounterDifficulties(draft.encounterId);
    let bossIndex = 0;
    let splitIndex = 0;
    workspace.innerHTML = `<p class="boss-message" role="status">${h(message || execution.reason)}</p><div class="boss-setup">
      <div class="boss-fields"><label>Boss<select id="boss-encounter">${encounterOptions(draft.encounterId)}</select></label>${modes.length > 1 ? `<label>Difficulty<select id="boss-mode">${modes.map((mode) => `<option value="${mode}" ${mode === draft.difficulty ? 'selected' : ''}>${modeNames[mode]}</option>`).join('')}</select></label>` : ''}</div>
      <div class="boss-phase-inputs" aria-label="Encounter phases">${draft.phases
        .map((phase, index) => {
          const definition = plan.phases[index]!;
          return phase.kind === 'boss'
            ? `<label class="boss-phase-input"><span>Phase ${++bossIndex} DPS</span><small>${h(definition.label)}</small><input type="number" data-phase-input="${h(phase.id)}" aria-label="Phase ${bossIndex} group DPS excluding you" min="0" max="1000000000" step="1000" value="${phase.groupDps}"><small data-phase-result="${h(phase.id)}"></small></label>`
            : `<label class="boss-phase-input boss-split-input"><span>Split ${++splitIndex} (seconds)</span><small>${h(definition.label)}</small><input type="number" data-phase-input="${h(phase.id)}" aria-label="Split ${splitIndex} duration in seconds" min="0" max="86400" step="0.1" placeholder="0" value="${phase.durationSeconds ?? ''}"><small data-phase-result="${h(phase.id)}"></small></label>`;
        })
        .join('')}</div>${plan.repeats ? '<small class="boss-muted">Repeating mechanic cycle</small>' : ''}
      <small class="boss-muted">Group DPS excludes you.</small></div>`;
    refreshPhaseResults();
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
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-boss-action]') : null;
    const action = trigger?.dataset.bossAction;

    if (!action) return;

    const rowIndex = scenarios.findIndex((entry) => entry.id === trigger?.dataset.scenarioId);

    handle(() => {
      editor.capture();

      if (action === 'new') {
        newDraft();
        return;
      }

      const draft = active()!;

      if (action === 'select' && rowIndex >= 0) {
        activeId = scenarios[rowIndex]!.id;
        save();
        menu.hidePopover();
        selector.focus();
        return;
      }

      // Closing an inactive row leaves the current scenario intact; the last closure creates a fresh default.
      if (action === 'close' && rowIndex >= 0) {
        const removed = scenarios[rowIndex]!;
        editor.discard(removed.id);
        scenarios.splice(rowIndex, 1);

        if (activeId === removed.id) activeId = scenarios[Math.min(rowIndex, scenarios.length - 1)]?.id ?? '';

        if (!activeId) newDraft();
        else save();

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

    if (action === 'close' && menu.matches(':popover-open')) {
      const rows = menu.querySelectorAll<HTMLButtonElement>('[data-boss-action="close"]');
      rows[Math.min(rowIndex, rows.length - 1)]?.focus({ preventScroll: true });
    }
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
    } finally {
      control.value = '';
    }
  });
  document.addEventListener(SIMULATOR_VIEW_CHANGE_EVENT, () => render());
  document.addEventListener(ENCOUNTER_RESULT_EVENT, () => {
    if (workspace.childElementCount && document.body.dataset.analysisWorkspace === 'bosses') render(true);
  });
  render();
}
