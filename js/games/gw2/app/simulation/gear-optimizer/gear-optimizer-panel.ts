import { candidatePicker, updatePicker, bindCandidatePickers } from '#gw2/app/build/equipment-picker.js';
import { PREFIXES, INFUSION_STATS } from '#gw2/platform/equipment/gear/stats.js';
import { EQUIPMENT_ICONS } from '#gw2/platform/equipment/icons.js';
import { RUNE_NAMES } from '#gw2/platform/equipment/gear/runes.js';
import { FOOD_NAMES } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_NAMES } from '#gw2/platform/equipment/consumables/utilities.js';
import { SIGIL_NAMES, SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/catalog.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';
import {
  prefixOptionLabel,
  runeOptionLabel,
  relicOptionLabel,
  foodOptionLabel,
  utilityOptionLabel,
  sigilOptionLabel
} from '#gw2/app/build/equipment-option-labels.js';
import {
  captureGearOptimizerRequest,
  optimizerSlots,
  optimizerWeaponSets,
  optimizerEquipment,
  applyOptimizerCandidate,
  isOptimizerRequestCurrent,
  optimizerAppliedCandidate,
  OPTIMIZER_REQUIREMENTS,
  type GearOptimizerSelections,
  type OptimizerCandidate,
  type OptimizerEquipment
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import { MAX_OPTIMIZER_WORKERS } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-runner.js';
import {
  OPTIMIZER_RESULT_FILTERS,
  optimizerEquipmentIdentity,
  type OptimizerResultFilter
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer-results.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { renderOptimizerPreview } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-preview.js';

const filterDismissalRoots = new WeakSet<Document>();

const SLOT_LABELS: Record<string, string> = {
  Helm: 'Helm',
  Shoulders: 'Shld',
  Chest: 'Coat',
  Gloves: 'Glov',
  Leggins: 'Legs',
  Boots: 'Boot',
  Amulet: 'Amul',
  Ring1: 'Rng1',
  Ring2: 'Rng2',
  Accessory1: 'Acc1',
  Accessory2: 'Acc2',
  Back: 'Back',
  Weapon1: 'Main hand',
  Weapon2: 'Off hand',
  AlternateWeapon1: 'Main hand',
  AlternateWeapon2: 'Off hand'
};

/** Show each equipment choice consistently, with full names available on icons and abbreviated cells. */
function equipmentCell(label: string, value: string, compact = false, icon?: string): string {
  const name = value || 'None';
  return `<td class="optimizer-equipment" aria-label="${escapeHtml(`${label}: ${name}`)}" title="${escapeHtml(`${label}: ${name}`)}">${icon ? `<img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" width="24" height="24">` : `<span>${escapeHtml(compact ? name.slice(0, 4) : name)}</span>`}</td>`;
}

function slotPrefix(equipment: OptimizerEquipment, slot: string): string {
  return slot.startsWith('Alternate')
    ? equipment.alternateWeaponPrefixes[Number(slot.at(-1)) - 1]
    : equipment.gear[slot];
}

/** Keep the visible and accessible selection tied to the character preview, including after result refreshes. */
function updatePreviewSelection(panel: HTMLElement, candidates: OptimizerCandidate[]): void {
  panel.querySelectorAll<HTMLElement>('[data-preview]').forEach((row) => {
    const index = Number(row.dataset.preview);
    const key = index < 0 ? 'equipped' : candidates[index]?.key;
    const selected = panel.dataset.selectedKey !== undefined && panel.dataset.selectedKey === key;
    row.classList.toggle('optimizer-selected', selected);
    if (selected) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  });
}

/** Keep selectors outside the simulation result subtree so baseline rendering cannot discard an active search. */
export function renderGearOptimizer(app: ProfessionAppState): void {
  const runner = app.gearOptimizerRunner;
  if (!runner || typeof document === 'undefined') return;
  let panel = document.getElementById('gear-optimizer');
  const displayedResults = (): OptimizerCandidate[] => {
    const filter = (panel?.querySelector<HTMLInputElement>('input[name="optimizer-filter"]:checked')?.value ||
      'none') as OptimizerResultFilter;
    const results = filter === 'none' ? runner.state.winners : runner.state.groups[filter];
    const equipped =
      runner.request &&
      optimizerEquipmentIdentity(
        optimizerAppliedCandidate(app, runner.request)?.equipment || optimizerEquipment(runner.request.build)
      );
    return results.filter((candidate) => optimizerEquipmentIdentity(candidate.equipment) !== equipped);
  };

  if (!panel) {
    const results = document.getElementById('optimizer-search');
    if (!results) return;
    // The tab supplies the title; open directly on its controls without a second disclosure heading.
    panel = document.createElement('div');
    panel.id = 'gear-optimizer';
    panel.className = 'gear-optimizer';
    panel.innerHTML = `<form data-role="optimizer-form"><div data-role="optimizer-controls"></div>
      <div class="optimizer-actions"><p data-role="optimizer-estimate"></p><div><label class="optimizer-worker-count">Workers<input name="workers" aria-label="Workers" type="number" min="1" max="${MAX_OPTIMIZER_WORKERS}" step="1" value="${runner.workerCount}"></label><button type="button" data-role="optimizer-cancel">Cancel</button><button type="submit">Run optimizer</button></div></div></form>
      <div class="optimizer-feedback">
      <div class="optimizer-status-row"><div class="optimizer-status-text"><p data-role="optimizer-status" role="status" aria-live="polite"></p><p data-role="optimizer-counts"></p></div>
      <details class="optimizer-filter-settings"><summary aria-label="Filter results" title="Filter results">&#9881;</summary>
      <fieldset><legend>Filter results</legend>${Object.entries(OPTIMIZER_RESULT_FILTERS)
        .map(
          ([value, label]) =>
            `<label><input type="radio" name="optimizer-filter" value="${value}"${value === 'none' ? ' checked' : ''}>${label}</label>`
        )
        .join('')}
      <p>Show the best result found for each option or combination, up to 100 results.</p></fieldset></details></div>
      <progress data-role="optimizer-progress" max="100" value="0" aria-label="Optimizer coverage"></progress>
      <p data-role="optimizer-warnings"></p></div>
      <div data-role="optimizer-results"></div>
      <section data-role="optimizer-preview" class="optimizer-preview" aria-label="Result character" hidden></section>`;
    results.append(panel);
    const form = panel.querySelector('form')!;
    const estimate = (): void => {
      try {
        captureGearOptimizerRequest(app, readSelections(form), { kind: 'rotation' }, 'fast');
        panel!.querySelector('[data-role="optimizer-estimate"]')!.textContent = '';
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-estimate"]')!.textContent = String(
          error instanceof Error ? error.message : error
        );
      }
    };

    bindCandidatePickers(form);
    form.addEventListener('change', () => {
      runner.cancel();
      estimate();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        if (app.simulationStatus !== 'idle' || app.resultRevision !== app.buildRevision)
          throw new Error('Wait for the current build simulation to finish.');
        const request = captureGearOptimizerRequest(app, readSelections(form), { kind: 'rotation' }, 'fast');
        app.randomDistributionRunner.cancel?.();
        app.modifierContributionRunner.cancel?.();
        app.relicComparisonRunner.cancel?.();
        runner.run(request, Number(new FormData(form).get('workers')));
      } catch (error) {
        panel!.querySelector<HTMLElement>('.optimizer-feedback')!.hidden = false;
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(
          error instanceof Error ? error.message : error
        );
      }
    });
    panel.querySelector('[data-role="optimizer-cancel"]')!.addEventListener('click', () => runner.cancel());
    // Outside clicks close the optimizer filter even when no results view has been mounted.
    const root = panel.ownerDocument;
    if (!filterDismissalRoots.has(root)) {
      filterDismissalRoots.add(root);
      root.addEventListener('pointerdown', (event) => {
        const settings = root.querySelector<HTMLDetailsElement>('.optimizer-filter-settings[open]');
        if (settings && !settings.contains(event.target as Node)) settings.open = false;
      });
    }

    // Result filters only change the displayed rows; the completed search and equipped build stay intact.
    panel.querySelector('.optimizer-filter-settings')!.addEventListener('change', () => renderGearOptimizer(app));
    panel.querySelector<HTMLDetailsElement>('.optimizer-filter-settings')!.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const settings = event.currentTarget as HTMLDetailsElement;
      settings.open = false;
      settings.querySelector('summary')!.focus();
    });
    const selectResult = (event: MouseEvent | KeyboardEvent): void => {
      const element = event.target as HTMLElement;
      if (event instanceof KeyboardEvent) {
        if (element.closest('button') || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
      }

      const row = element.closest<HTMLElement>('[data-preview]');
      if (!row || !runner.request) return;
      const index = Number(row.dataset.preview);
      const applied = optimizerAppliedCandidate(app, runner.request);
      const candidate =
        index < 0
          ? {
              key: 'equipped',
              equipment: applied?.equipment || optimizerEquipment(runner.request.build),
              score: applied?.score || runner.state.baseline!,
              represented: '1'
            }
          : displayedResults()[index];
      if (!candidate) return;
      try {
        if (element.closest('[data-apply]')) {
          if (runner.state.status !== 'complete') return;
          applyOptimizerCandidate(app, runner.request, candidate);
          renderGearOptimizer(app);
        } else {
          panel!.dataset.selectedKey = candidate.key;
          updatePreviewSelection(panel!, displayedResults());
          renderOptimizerPreview(
            panel!.querySelector<HTMLElement>('[data-role="optimizer-preview"]')!,
            app,
            runner.request,
            candidate
          );
        }
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(error);
      }
    };

    panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!.addEventListener('click', selectResult);
    panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!.addEventListener('keydown', selectResult);
  }

  if (panel.dataset.revision !== String(app.buildRevision)) {
    panel.dataset.revision = String(app.buildRevision);
    const build = app.build;
    const slots = optimizerSlots(build, app.adapter);
    // Seed actual choices so adding alternatives preserves the equipped options in the search.
    const prefixes = [...new Set(slots.map((slot) => slotPrefix(build, slot) || build.gear[`Weapon${slot.at(-1)}`]))];
    const sigils = [build.weapons, build.alternateWeapons]
      .flatMap((weapons, set) =>
        !optimizerWeaponSets(build, app.adapter).includes(set)
          ? []
          : [
              `<fieldset class="optimizer-section"><legend>Weapon set ${set + 1}<span>${weapons.filter(Boolean).map(escapeHtml).join(' / ')}</span></legend><div class="optimizer-pair">${[
                0, 1
              ]
                .map((slot) => {
                  const key = `sigil${set + 1}-${slot + 1}`;
                  return candidatePicker(
                    key,
                    `Set ${set + 1} sigil ${slot + 1}`,
                    SIGIL_NAMES,
                    [build.weaponSigils[set][slot]],
                    0,
                    sigilOptionLabel
                  );
                })
                .join('')}</div></fieldset>`
            ]
      )
      .join('');
    panel.querySelector('[data-role="optimizer-controls"]')!.innerHTML = `<div class="optimizer-columns">
      <fieldset class="optimizer-section optimizer-prefixes"><legend>Equipment stats</legend>
        ${candidatePicker('prefixes', 'Prefixes', PREFIXES, prefixes, 3, prefixOptionLabel, 'Keep all current prefixes')}
      </fieldset>
      <fieldset class="optimizer-section"><legend>Runes &amp; relic</legend><div class="optimizer-pair">
        ${candidatePicker('rune', 'Rune sets', ['', ...RUNE_NAMES], [build.rune || ''], 0, runeOptionLabel)}
        ${candidatePicker('relic', 'Relics', ['', ...app.relicNames], [build.relic || ''], 0, relicOptionLabel)}
      </div></fieldset>
      ${sigils}
      <fieldset class="optimizer-section"><legend>Consumables</legend><div class="optimizer-pair">
        ${candidatePicker('food', 'Food', ['', ...FOOD_NAMES], [build.food || ''], 3, foodOptionLabel)}
        ${candidatePicker('utility', 'Utility', ['', ...UTILITY_NAMES], [build.utility || ''], 3, utilityOptionLabel)}
      </div></fieldset>
      <fieldset class="optimizer-section"><legend>Infusions</legend><div class="optimizer-infusion-row">
        ${candidatePicker('infusionStats', 'Infusion stats', INFUSION_STATS, [...new Set(build.infusions.filter((entry) => entry.count).map((entry) => entry.stat))], 2, undefined, 'Choose stats to change the infusion total')}
        <label class="optimizer-infusion-count">Total slots<input name="infusionCount" aria-label="Total infusions" type="number" min="0" max="18" step="1" value="${build.infusions.reduce((sum, entry) => sum + entry.count, 0)}"></label>
      </div></fieldset>
      <fieldset class="optimizer-section"><legend>Requirements (optional)</legend>
        <div class="optimizer-pair">${Object.entries(OPTIMIZER_REQUIREMENTS)
          .map(
            ([key, label]) =>
              `<label class="optimizer-infusion-count">${label}<input name="${key}" type="number" min="0" ${key.endsWith('Duration') ? 'max="100"' : ''} step="any" placeholder="No limit"></label>`
          )
          .join('')}</div>
      </fieldset></div>`;
    panel.querySelectorAll<HTMLElement>('[data-picker]').forEach(updatePicker);
    // An invalid current build can disable optimization without interrupting the normal editor's change flow.
    try {
      captureGearOptimizerRequest(app, readSelections(panel.querySelector('form')!), { kind: 'rotation' }, 'fast');
      panel.querySelector('[data-role="optimizer-estimate"]')!.textContent = '';
    } catch (error) {
      panel.querySelector('[data-role="optimizer-estimate"]')!.textContent = String(
        error instanceof Error ? error.message : error
      );
    }
  }

  const state = runner.state;
  const applied = runner.request && optimizerAppliedCandidate(app, runner.request);
  const equippedScore = applied?.score || state.baseline;
  panel.querySelector<HTMLElement>('.optimizer-feedback')!.hidden = state.status === 'idle';
  const stale = runner.request !== null && !isOptimizerRequestCurrent(app, runner.request);
  // A new search or unrelated edit invalidates the selected character along with its captured build context.
  const preview = panel.querySelector<HTMLElement>('[data-role="optimizer-preview"]')!;
  const previewRequest = `${runner.request?.revision}:${state.started}`;
  if (preview.dataset.request !== previewRequest || stale) {
    preview.dataset.request = previewRequest;
    preview.hidden = true;
    preview.innerHTML = '';
    delete panel.dataset.selectedKey;
  }

  const status =
    state.status === 'failed'
      ? `Failed: ${state.error}`
      : state.status === 'canceled'
        ? 'Canceled.'
        : state.status === 'complete'
          ? 'Complete.'
          : state.status === 'preparing'
            ? 'Preparing candidates and workers…'
            : state.status === 'verifying'
              ? 'Verifying winners with detailed simulation…'
              : state.status === 'running'
                ? 'Evaluating candidates…'
                : 'Ready to run.';
  panel.querySelector('[data-role="optimizer-status"]')!.textContent =
    `${status}${stale ? ' Results are stale; run again to apply.' : ''}`;
  (panel.querySelector('[data-role="optimizer-progress"]') as HTMLProgressElement).hidden =
    runner.request?.search === 'fast';
  (panel.querySelector('[data-role="optimizer-progress"]') as HTMLProgressElement).value = state.count
    ? Number((state.completed * 10000n) / state.count) / 100
    : 0;
  // Report measured work completed without predicting how long unseen candidates will take.
  panel.querySelector('[data-role="optimizer-counts"]')!.textContent = state.count
    ? runner.request?.search === 'fast'
      ? `${state.completed.toLocaleString()} candidates checked.${state.completed !== state.simulations ? ` ${state.simulations.toLocaleString()} simulations; ${(state.completed - state.simulations).toLocaleString()} rejected by requirements.` : ''}`
      : `${state.completed.toLocaleString()} / ${state.count.toLocaleString()} candidates checked; ${state.simulations.toLocaleString()} simulations.`
    : '';

  panel.querySelector('[data-role="optimizer-warnings"]')!.textContent = [...state.warnings]
    .map(([warning, count]) => `${warning} (${count.toLocaleString()} evaluated candidates)`)
    .join(' • ');
  if (equippedScore?.warnings.length) {
    panel.querySelector('[data-role="optimizer-warnings"]')!.textContent +=
      ` Current-build warnings: ${equippedScore.warnings.join(' • ')}`;
  }

  const list = panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!;
  const candidates = displayedResults();
  const signature = JSON.stringify([
    state.status,
    runner.request?.revision,
    equippedScore?.dps,
    applied?.key,
    state.winners[0]?.key,
    candidates.map((winner) => [winner.key, winner.equipment, winner.score.dps])
  ]);
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    const baseline = equippedScore?.dps || 0;
    const slots = runner.request ? optimizerSlots(runner.request.build, app.adapter) : [];
    const sets = runner.request ? optimizerWeaponSets(runner.request.build, app.adapter) : [];
    const best = candidates[0] || state.winners[0];
    // Rank against the equipped setup as well as search results, using unrounded DPS for labels and comparisons.
    const bestDps = Math.max(baseline, best?.score.dps || 0, state.winners[0]?.score.dps || 0);
    const infusions = (equipment: OptimizerEquipment): string =>
      equipment.infusions
        .filter((entry) => entry.count)
        .map((entry) => `${entry.count} ${entry.stat}`)
        .join(', ');
    // Reuse the equipment columns for a sticky baseline row outside the filtered rankings.
    const renderRow = (candidate: OptimizerCandidate, index: number, pinned = false): string => {
      const equipment = candidate.equipment;
      const difference = candidate.score.dps - baseline;
      const percent = bestDps ? (candidate.score.dps / bestDps - 1) * 100 : 0;
      const isBest = candidate.score.dps === bestDps;
      return `<tr tabindex="0" data-preview="${index}" class="${pinned ? 'optimizer-equipped ' : ''}${isBest ? 'optimizer-best' : ''}"${pinned ? ' aria-label="Equipped setup"' : ''}><td class="optimizer-damage"><strong>${candidate.score.dps.toFixed(2)}</strong>${pinned ? '<small>Equipped</small>' : ''}${isBest ? '<small>Best</small>' : `<small>${percent.toFixed(1)}%</small>`}<span class="optimizer-preview-marker">Previewing</span></td>${slots.map((slot) => equipmentCell(slot, slotPrefix(equipment, slot), true)).join('')}${sets
        .map((set) =>
          [0, 1]
            .map((slot) => {
              const value = equipment.weaponSigils[set][slot];
              return equipmentCell(`Set ${set + 1} sigil ${slot + 1}`, value, true, SIGIL_DATA[value]?.icon);
            })
            .join('')
        )
        .join(
          ''
        )}${equipmentCell('Rune', equipment.rune, true, EQUIPMENT_ICONS[equipment.rune])}${equipmentCell('Relic', equipment.relic, true, (RELIC_DATA as Record<string, { icon?: string }>)[equipment.relic]?.icon)}${equipmentCell('Food', equipment.food, false, EQUIPMENT_ICONS[equipment.food])}${equipmentCell('Utility', equipment.utility, false, EQUIPMENT_ICONS[equipment.utility])}${equipmentCell('Infusions', infusions(equipment))}<td class="optimizer-delta">${difference >= 0 ? '+' : ''}${difference.toFixed(2)}</td><td>${pinned ? '&mdash;' : `<button type="button" data-apply="${index}" aria-label="Apply result ${index + 1}">Apply</button>`}</td></tr>${!pinned && candidate.score.warnings.length ? `<tr class="optimizer-result-warning"><td colspan="${slots.length + sets.length * 2 + 8}">${candidate.score.warnings.map(escapeHtml).join('<br>')}</td></tr>` : ''}`;
    };

    // Spell out weapon slots and put the set on its own line so adjacent headers stay distinguishable.
    list.innerHTML = best
      ? `<div class="optimizer-table-scroll" tabindex="0" role="region" aria-label="Gear optimizer results"><table aria-label="Gear comparison"><thead><tr><th scope="col">Damage <small>vs best</small></th>${slots.map((slot) => `<th scope="col">${SLOT_LABELS[slot] || escapeHtml(slot)}${slot.includes('Weapon') ? `<small class="optimizer-weapon-set">Weapon set ${slot.startsWith('Alternate') ? 2 : 1}</small>` : ''}</th>`).join('')}${sets.map((set) => [0, 1].map((slot) => `<th scope="col">Sigil ${slot + 1}<small class="optimizer-weapon-set">Weapon set ${set + 1}</small></th>`).join('')).join('')}<th scope="col">Rune</th><th scope="col">Relic</th><th scope="col">Food</th><th scope="col">Utility</th><th scope="col">Infusions</th><th scope="col">&Delta; equipped</th><th scope="col">Apply</th></tr></thead><tbody>${candidates.map((candidate, index) => renderRow(candidate, index)).join('')}</tbody><tfoot>${equippedScore && runner.request ? renderRow({ key: 'equipped', equipment: applied?.equipment || optimizerEquipment(runner.request.build), score: equippedScore, represented: '1' }, -1, true) : ''}</tfoot></table></div>`
      : state.status === 'complete'
        ? '<p>No gear combinations met the requirements in this search.</p>'
        : '';
  }

  updatePreviewSelection(panel, candidates);
  list.querySelectorAll<HTMLButtonElement>('[data-apply]').forEach((button) => {
    button.disabled = stale || state.status !== 'complete';
  });
  (panel.querySelector('[data-role="optimizer-cancel"]') as HTMLButtonElement).disabled = !runner.isRunning;
  (panel.querySelector('[data-role="optimizer-cancel"]') as HTMLButtonElement).hidden = !runner.isRunning;
  (panel.querySelector('button[type="submit"]') as HTMLButtonElement).disabled = runner.isRunning;
  panel.querySelector<HTMLInputElement>('input[name="workers"]')!.disabled = runner.isRunning;
}

/** Removable chips submit explicit choices; empty groups retain the equipped item and None remains an actual choice. */
function readSelections(form: HTMLFormElement): GearOptimizerSelections {
  const data = new FormData(form);
  const values = (key: string): string[] => data.getAll(key).map(String);
  // Keep empty numeric inputs absent so blank maximums do not become zero.
  const requirements = Object.fromEntries(
    Object.keys(OPTIMIZER_REQUIREMENTS).flatMap((key) => {
      const value = String(data.get(key) ?? '').trim();
      return value === '' ? [] : [[key, Number(value)]];
    })
  );
  return {
    ...requirements,
    prefixes: values('prefixes'),
    rune: values('rune'),
    relic: values('relic'),
    food: values('food'),
    utility: values('utility'),
    infusionStats: values('infusionStats'),
    infusionCount: Number(data.get('infusionCount')),
    sigils: [1, 2].map((set) => [1, 2].map((slot) => values(`sigil${set}-${slot}`)))
  };
}
