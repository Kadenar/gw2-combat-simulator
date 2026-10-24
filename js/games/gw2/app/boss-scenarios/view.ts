import { encounterAnalysisPhases, encounterDpsSnapshots } from '#gw2/app/boss-scenarios/analysis-model.js';
import { loadScenarioLibrary, saveScenarioLibrary } from '#gw2/app/boss-scenarios/storage.js';
import { createEncounter, type EncounterResult } from '#gw2/platform/combat/state/encounter.js';
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

  // Keep the disclosure mounted so edits and simulation results preserve the user's expanded/collapsed choice.
  const workspace = document.createElement('details');
  workspace.id = 'boss-workspace';
  workspace.className = 'boss-workspace rotation-procs-wrap';
  workspace.open = true;
  workspace.innerHTML = '<summary>Boss configuration</summary>';
  const controls = document.createElement('div');
  workspace.append(controls);
  workspace.setAttribute('aria-label', 'Boss encounter setup');
  const toolbar = document.createElement('div');
  toolbar.id = 'boss-scenario-toolbar';
  toolbar.className = 'boss-toolbar';
  host.querySelector('header')!.append(toolbar);
  const metrics = document.createElement('div');
  metrics.id = 'boss-encounter-summary';
  metrics.className = 'rotation-dps-summary';
  metrics.setAttribute('aria-label', 'Encounter metrics');
  document.getElementById('rotation-dps-summary')!.after(metrics);
  // Encounter assumptions live beside their results, below the shared rotation's DPS strip.
  metrics.after(workspace);

  let scenarios: BossScenarioDraft[] = [];
  let activeId = '';
  let message = '';
  let storageBlocked = false;
  let displayedSummary:
    | {
        key: string;
        encounter: EncounterResult;
        phaseSnapshots: ReturnType<typeof encounterDpsSnapshots>;
      }
    | undefined;
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
    const saved = loadScenarioLibrary(localStorage, app.contentId, parse);

    if (saved) {
      scenarios = saved.scenarios;
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
      saveScenarioLibrary(localStorage, app.contentId, { activeId, scenarios });
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
  const mutate = (edit: (draft: BossScenarioDraft) => void, rebuild = false): void => {
    const current = active();

    if (!current) return;

    editor.capture();
    const candidate = structuredClone(current);
    edit(candidate);
    Object.assign(current, parse(candidate));
    save();
    app.changed(rebuild);
  };

  const newDraft = (): void => {
    if (scenarios.length >= 100) throw new Error('The scenario library is full (100 drafts).');

    editor.capture();
    const source = editor.golem.tabs.find((tab) => tab.id === editor.golem.activeTabId)!;
    const draft = createBossScenario(
      active()?.encounterId ?? ENCOUNTER_TEMPLATES[0]!.id,
      source.build,
      source.name,
      source.patchId
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
    const first = plan.phases[0]!;
    const targetDefinitions = encounterHealth(draft.encounterId, draft.difficulty)!.targets;
    const execution = scenarioSimulation(draft);
    const freshResult =
      app.workspace?.scenario === draft && app.resultRevision === app.buildRevision
        ? app.results?.encounter
        : undefined;
    const summaryKey = JSON.stringify([draft.id, draft.encounterId, draft.difficulty]);

    // Keep the completed strip and its disclosure steady during recalculation, without borrowing another boss's data.
    if (displayedSummary?.key !== summaryKey) displayedSummary = undefined;

    if (freshResult)
      displayedSummary = {
        key: summaryKey,
        encounter: freshResult,
        phaseSnapshots: encounterDpsSnapshots(encounterAnalysisPhases(app.results!, plan.phases))
      };

    const result = displayedSummary?.encounter;
    metrics.setAttribute('aria-busy', String(!freshResult));
    // Preview the same phase-local health model before results arrive, including replacement health bars.
    const healthState = result ?? (execution.config ? createEncounter(execution.config, () => {}).result(0) : null);
    const seconds = (value: number | null) => (value === null ? 'No damage rate' : `${value.toFixed(1)}s`);
    const number = (value: number) => Math.round(value).toLocaleString('en-US');

    if (freshResult || !result) {
      metrics.replaceChildren();
      // Lead with player output, group health together, and keep static armor after transition progress.
      mountResultSummary(metrics, {
        metrics: [
          {
            label: 'Overall DPS',
            className: 'dps',
            value: result ? number(result.overallDps) : execution.config ? '—' : 'Unavailable'
          },
          {
            label: healthState ? `${healthState.targetName} HP / total` : 'Target HP / total',
            value: healthState
              ? `${number(healthState.remainingHealth)} / ${number(healthState.health)}`
              : format(draft.health)
          },
          {
            label: 'Next transition',
            value: result
              ? result.defeated
                ? 'Target defeated'
                : result.phaseKind !== 'boss'
                  ? result.phaseKind === 'intermission'
                    ? 'Intermission ends'
                    : 'Split ends'
                  : `${result.nextHealthPercent}% HP${result.windowRemaining !== null ? ` / ${seconds(result.windowRemaining)} window` : ''}`
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
              : healthState
                ? number(healthState.damageToTransition)
                : 'Unavailable'
          },
          {
            label: 'Estimated time to transition',
            value: result ? seconds(result.timeToTransition) : execution.config ? '—' : 'Unavailable'
          },
          { label: 'Target armor', value: format(healthState?.armor ?? null) }
        ],
        phaseSnapshots: result ? displayedSummary!.phaseSnapshots : []
      });
    }

    const targetHealthMarkup = () =>
      healthState?.targets
        .map(
          (target) =>
            `<small class="boss-muted">${h(target.name)}: ${number(target.remainingHealth)} / ${number(target.maximumHealth)}</small>`
        )
        .join(' &middot; ') ?? '';
    const refreshTargetHealth = () => {
      const targetHealth = workspace.querySelector('[data-encounter-targets]');

      if (targetHealth) targetHealth.innerHTML = targetHealthMarkup();
    };

    if (preserveControls) {
      refreshTargetHealth();
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
        <button type="button" class="build-tab-close" data-boss-action="close" data-scenario-id="${h(entry.id)}" aria-label="Close ${h(entry.name)}" title="Close"${scenarios.length === 1 ? ' disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
      })
      .join('');
    const modes = encounterDifficulties(draft.encounterId);
    let bossIndex = 0;
    const splitNumbers = new Map(
      draft.phases.filter((phase) => phase.kind === 'split').map((phase, index) => [phase.id, index + 1])
    );
    // Keep each split and its no-damage intermission beside the phase that leads into it.
    const splitCells = (index: number): string => {
      const split = draft.phases[index];

      if (split?.kind !== 'split') return '<td>&mdash;</td><td>&mdash;</td>';

      const name = plan.phases[index]!.label;
      const splitNumber = splitNumbers.get(split.id)!;
      return `<td><span class="boss-duration-input"><input type="number" data-phase-input="${h(split.id)}" aria-label="Split ${splitNumber}: ${h(name)} duration in seconds" min="0" max="86400" step="0.1" placeholder="0" value="${split.durationSeconds ?? ''}"><span aria-hidden="true">s</span></span><small>${h(name)}</small></td>
        <td><span class="boss-duration-input"><input type="number" data-phase-input="${h(split.id)}" data-intermission aria-label="Intermission after split ${splitNumber} in seconds" min="0" max="86400" step="0.1" value="${split.intermissionSeconds ?? 0}"><span aria-hidden="true">s</span></span></td>`;
    };

    controls.innerHTML = `<p class="boss-message" role="status">${h(message || execution.reason)}</p><div class="boss-setup">
      <div class="boss-fields"><label>Boss<select id="boss-encounter">${encounterOptions(draft.encounterId)}</select></label>${modes.length > 1 ? `<label>Difficulty<select id="boss-mode">${modes.map((mode) => `<option value="${mode}" ${mode === draft.difficulty ? 'selected' : ''}>${modeNames[mode]}</option>`).join('')}</select></label>` : ''}</div>
      <div class="boss-phase-scroll"><table class="boss-phase-table" aria-label="Encounter phases">
        <thead><tr><th scope="col">Boss phase</th><th scope="col">Group DPS (excludes you)</th><th scope="col">Split after phase</th><th scope="col">After split</th></tr></thead>
        <tbody>${draft.phases
          .map((phase, index) => {
            const definition = plan.phases[index]!;

            // Opening mechanics have no preceding boss phase, so retain their own row and editable durations.
            if (phase.kind === 'split')
              return draft.phases[index - 1]?.kind === 'boss'
                ? ''
                : `<tr><th scope="row">${index === 0 ? 'Opening split' : `Split ${splitNumbers.get(phase.id)}`}</th><td>&mdash;</td>${splitCells(index)}</tr>`;

            bossIndex += 1;
            const rates =
              typeof phase.groupDps === 'number'
                ? [{ key: '', name: '', value: phase.groupDps }]
                : Object.entries(phase.groupDps).map(([key, value]) => ({
                    key,
                    value,
                    name: targetDefinitions.find((target) => String(target.index) === key)!.name
                  }));
            const playerTarget =
              rates.length > 1
                ? `<label class="boss-phase-option"><small>Your target</small><select data-phase-input="${h(phase.id)}" data-player-target aria-label="Phase ${bossIndex} your target">${rates.map((rate) => `<option value="${h(rate.key)}" ${Number(rate.key) === phase.playerTargetIndex ? 'selected' : ''}>${h(rate.name)}</option>`).join('')}</select></label>`
                : '';
            const damageWindow = definition.damageWindow
              ? `<label class="boss-phase-option"><small>${h(definition.damageWindow.label)}</small><span class="boss-duration-input"><input type="number" data-phase-input="${h(phase.id)}" data-damage-window aria-label="Phase ${bossIndex} damage window in seconds" min="0.1" max="86400" step="0.1" value="${phase.windowSeconds ?? definition.damageWindow.defaultSeconds}"><span aria-hidden="true">s</span></span></label>`
              : '';
            return `<tr><th scope="row"><span class="boss-phase-heading">Phase ${bossIndex}<small>${h(definition.label)}</small></span>${playerTarget}${damageWindow}</th>
            <td>${rates.map((rate) => `<label class="boss-rate-input">${rate.name ? `<small>${h(rate.name)}</small>` : ''}<input type="number" data-phase-input="${h(phase.id)}" data-target-dps="${h(rate.key)}" aria-label="Phase ${bossIndex}${rate.name ? ` ${h(rate.name)}` : ''} group DPS excluding you" min="0" max="1000000000" step="1000" value="${rate.value}"></label>`).join('')}</td>
            ${splitCells(index + 1)}</tr>`;
          })
          .join(
            ''
          )}</tbody></table></div>${plan.repeats ? '<small class="boss-muted">Repeating mechanic cycle</small>' : ''}
      ${(healthState?.targets.length ?? 0) > 1 ? `<div data-encounter-targets>${targetHealthMarkup()}</div>` : ''}</div>`;
    refreshTargetHealth();
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

    // Keep the final encounter and its build intact, matching the Golem workspace's last-tab rule.
    if (!action || (action === 'close' && scenarios.length <= 1)) return;

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

      // Closing an inactive row preserves the current scenario; closing the active row selects a surviving neighbor.
      if (action === 'close' && rowIndex >= 0) {
        const removed = scenarios[rowIndex]!;
        editor.discard(removed.id);
        scenarios.splice(rowIndex, 1);

        if (activeId === removed.id) activeId = scenarios[Math.min(rowIndex, scenarios.length - 1)]!.id;

        save();

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
      const next = rows[Math.min(rowIndex, rows.length - 1)];
      const focusTarget = next?.disabled
        ? menu.querySelector<HTMLButtonElement>('[data-boss-action="select"][aria-pressed="true"]')
        : next;
      focusTarget?.focus({ preventScroll: true });
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

            if (phase.kind === 'boss' && control.hasAttribute('data-player-target'))
              phase.playerTargetIndex = Number(control.value);
            else if (phase.kind === 'boss' && control.hasAttribute('data-damage-window'))
              phase.windowSeconds = Number(control.value);
            else if (phase.kind === 'boss' && typeof phase.groupDps === 'object')
              phase.groupDps[control.dataset.targetDps!] = Number(control.value);
            else if (phase.kind === 'boss') phase.groupDps = Number(control.value);
            else if (control.hasAttribute('data-intermission')) phase.intermissionSeconds = Number(control.value);
            else phase.durationSeconds = control.value === '' ? null : Number(control.value);
          }
        }, control instanceof HTMLSelectElement),
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
    if (controls.childElementCount && document.body.dataset.analysisWorkspace === 'bosses') render(true);
  });
  render();
}
