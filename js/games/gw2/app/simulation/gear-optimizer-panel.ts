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
  createOptimizerSpace,
  optimizerSlots,
  optimizerWeaponSets,
  applyOptimizerCandidate,
  type GearOptimizerSelections,
  type OptimizerEquipment
} from '#gw2/app/simulation/gear-optimizer.js';
import { estimateOptimizerCount } from '#gw2/app/simulation/gear-optimizer-space.js';
import { MAX_OPTIMIZER_WORKERS } from '#gw2/app/simulation/gear-optimizer-runner.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

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
  Weapon1: 'Wep1',
  Weapon2: 'Wep2',
  AlternateWeapon1: 'S2 W1',
  AlternateWeapon2: 'S2 W2'
};

/** Each candidate exposes the same columns; color marks changes from the highest-ranked equipment. */
function equipmentCell(label: string, value: string, best: string, compact = false, icon?: string): string {
  const name = value || 'None';
  return `<td class="optimizer-equipment${value !== best ? ' optimizer-changed' : ''}" aria-label="${escapeHtml(`${label}: ${name}`)}" title="${escapeHtml(`${label}: ${name}`)}">${icon ? `<img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" width="24" height="24">` : `<span>${escapeHtml(compact ? name.slice(0, 4) : name)}</span>`}</td>`;
}

function slotPrefix(equipment: OptimizerEquipment, slot: string): string {
  return slot.startsWith('Alternate')
    ? equipment.alternateWeaponPrefixes[Number(slot.at(-1)) - 1]
    : equipment.gear[slot];
}

/** Ordinary selects add visible removable choices; users never need Ctrl-click or a separate upgrade lock. */
function candidatePicker(
  key: string,
  label: string,
  names: readonly string[],
  current: readonly string[] = [],
  limit = 0,
  describe: (name: string) => string = (name) => name,
  emptyLabel = 'Keep current equipment'
): string {
  return `<div class="optimizer-picker" data-picker="${key}" data-limit="${limit}">
    <div class="optimizer-picker-heading"><label for="optimizer-add-${key}">${escapeHtml(label)}</label>${limit ? `<span>Up to ${limit}</span>` : ''}</div>
    <div class="optimizer-choices">${current.map((name) => candidateChip(key, name, describe(name))).join('')}</div>
    <p class="optimizer-picker-empty" title="${escapeHtml(emptyLabel)}">${escapeHtml(emptyLabel)}</p>
    <select id="optimizer-add-${key}" data-add-choice aria-label="Add ${escapeHtml(label.toLowerCase())}">
      <option value="" disabled selected>Add a choice…</option>${names.map((name, index) => `<option value="${index}" data-choice="${escapeHtml(name)}"${current.includes(name) ? ' disabled' : ''}>${escapeHtml(name ? describe(name) : 'None')}</option>`).join('')}
    </select></div>`;
}

function candidateChip(key: string, value: string, description: string): string {
  return `<span class="optimizer-choice" title="${escapeHtml(description || 'None')}"><input type="hidden" name="${key}" value="${escapeHtml(value)}"><span>${escapeHtml(value || 'None')}</span><button type="button" data-remove-choice aria-label="Remove ${escapeHtml(value || 'None')} from ${key}">×</button></span>`;
}

/** Hide selected options and enforce caps before submission while keeping every selected value visible. */
function updatePicker(picker: HTMLElement): void {
  const values = [...picker.querySelectorAll<HTMLInputElement>('input')].map((input) => input.value);
  const limit = Number(picker.dataset.limit);
  const select = picker.querySelector<HTMLSelectElement>('select')!;
  for (const option of select.options) {
    if (option.dataset.choice !== undefined) option.disabled = values.includes(option.dataset.choice);
  }

  select.disabled = Boolean(limit && values.length >= limit);
  picker.querySelector<HTMLElement>('.optimizer-picker-empty')!.hidden = values.length > 0;
}

/** Keep selectors outside the simulation result subtree so baseline rendering cannot discard an active search. */
export function renderGearOptimizer(app: ProfessionAppState): void {
  const runner = app.gearOptimizerRunner;
  if (!runner || typeof document === 'undefined') return;
  let panel = document.getElementById('gear-optimizer');
  if (!panel) {
    const results = document.getElementById('rotation-results');
    if (!results) return;
    panel = document.createElement('details');
    panel.id = 'gear-optimizer';
    panel.className = 'gear-optimizer';
    panel.innerHTML = `<summary><span>Gear optimizer<small>Find the best equipment for your rotation</small></span></summary>
      <form data-role="optimizer-form"><div data-role="optimizer-controls"></div>
      <div class="optimizer-actions"><p data-role="optimizer-estimate"></p><div><label class="optimizer-worker-count">Workers<input name="workers" aria-label="Workers" type="number" min="1" max="${MAX_OPTIMIZER_WORKERS}" step="1" value="${runner.workerCount}"></label><button type="button" data-role="optimizer-cancel">Cancel</button><button type="submit">Run optimizer</button></div></div></form>
      <div class="optimizer-feedback">
      <p data-role="optimizer-status" role="status" aria-live="polite"></p>
      <progress data-role="optimizer-progress" max="100" value="0" aria-label="Optimizer coverage"></progress>
      <p data-role="optimizer-counts"></p><p data-role="optimizer-warnings"></p></div>
      <div data-role="optimizer-results"></div>`;
    results.before(panel);
    const form = panel.querySelector('form')!;
    const estimate = (): void => {
      try {
        const request = captureGearOptimizerRequest(app, readSelections(form));
        const count = estimateOptimizerCount(createOptimizerSpace(request, app.adapter), app.adapter);
        panel!.querySelector('[data-role="optimizer-estimate"]')!.textContent =
          `Up to ${count.toLocaleString()} candidates before stat merging.`;
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-estimate"]')!.textContent = String(
          error instanceof Error ? error.message : error
        );
      }
    };

    form.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement;
      if (select.matches('[data-add-choice]')) {
        const option = select.selectedOptions[0];
        const picker = select.closest<HTMLElement>('[data-picker]')!;
        if (option?.dataset.choice === undefined) return;
        picker
          .querySelector('.optimizer-choices')!
          .insertAdjacentHTML(
            'beforeend',
            candidateChip(picker.dataset.picker!, option.dataset.choice, option.textContent || '')
          );
        select.value = '';
        updatePicker(picker);
      }

      runner.cancel();
      estimate();
    });
    form.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('[data-remove-choice]');
      if (!button) return;
      const picker = button.closest<HTMLElement>('[data-picker]')!;
      const select = picker.querySelector<HTMLSelectElement>('select')!;
      button.closest('.optimizer-choice')!.remove();
      updatePicker(picker);
      select.focus();
      runner.cancel();
      estimate();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        if (app.simulationStatus !== 'idle' || app.resultRevision !== app.buildRevision)
          throw new Error('Wait for the current build simulation to finish.');
        const request = captureGearOptimizerRequest(app, readSelections(form));
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
    panel.querySelector('[data-role="optimizer-results"]')!.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-apply]');
      if (!target || !runner.request || runner.state.status !== 'complete') return;
      const candidate = runner.state.winners[Number(target.dataset.apply)];
      try {
        applyOptimizerCandidate(app, runner.request, candidate);
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(error);
      }
    });
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
      </div></fieldset></div>`;
    panel.querySelectorAll<HTMLElement>('[data-picker]').forEach(updatePicker);
    // An invalid current build can disable optimization without interrupting the normal editor's change flow.
    try {
      const request = captureGearOptimizerRequest(app, readSelections(panel.querySelector('form')!));
      panel.querySelector('[data-role="optimizer-estimate"]')!.textContent =
        `Up to ${estimateOptimizerCount(createOptimizerSpace(request, app.adapter), app.adapter).toLocaleString()} candidates before stat merging.`;
    } catch (error) {
      panel.querySelector('[data-role="optimizer-estimate"]')!.textContent = String(
        error instanceof Error ? error.message : error
      );
    }
  }

  const state = runner.state;
  panel.querySelector<HTMLElement>('.optimizer-feedback')!.hidden = state.status === 'idle';
  const stale = runner.request !== null && runner.request.revision !== app.buildRevision;
  const status =
    state.status === 'failed'
      ? `Failed: ${state.error}. Best found so far; incomplete.`
      : state.status === 'canceled'
        ? 'Canceled. Best found so far; incomplete.'
        : state.status === 'complete'
          ? 'Complete — results verified.'
          : state.status === 'preparing'
            ? 'Merging equivalent gear and preparing workers…'
            : state.status === 'verifying'
              ? 'Verifying winners with detailed simulation…'
              : state.status === 'running'
                ? 'Evaluating candidates…'
                : 'Ready to run.';
  panel.querySelector('[data-role="optimizer-status"]')!.textContent =
    `${status}${stale ? ' Results are stale; run again to apply.' : ''}`;
  (panel.querySelector('[data-role="optimizer-progress"]') as HTMLProgressElement).value = state.count
    ? Number((state.completed * 10000n) / state.count) / 100
    : 0;
  // Report measured work completed without predicting how long unseen candidates will take.
  panel.querySelector('[data-role="optimizer-counts"]')!.textContent = state.count
    ? `${state.completed.toLocaleString()} / ${state.count.toLocaleString()} candidates checked; ${state.simulations.toLocaleString()} simulations.`
    : '';

  panel.querySelector('[data-role="optimizer-warnings"]')!.textContent = [...state.warnings]
    .map(([warning, count]) => `${warning} (${count.toLocaleString()} evaluated candidates)`)
    .join(' • ');
  if (state.baseline?.warnings.length) {
    panel.querySelector('[data-role="optimizer-warnings"]')!.textContent +=
      ` Current-build warnings: ${state.baseline.warnings.join(' • ')}`;
  }

  const list = panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!;
  const signature = JSON.stringify(state.winners.map((winner) => [winner.key, winner.score.dps]));
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    const baseline = state.baseline?.dps || 0;
    const slots = runner.request ? optimizerSlots(runner.request.build, app.adapter) : [];
    const sets = runner.request ? optimizerWeaponSets(runner.request.build, app.adapter) : [];
    const best = state.winners[0];
    const infusions = (equipment: OptimizerEquipment): string =>
      equipment.infusions
        .filter((entry) => entry.count)
        .map((entry) => `${entry.count} ${entry.stat}`)
        .join(', ');
    list.innerHTML = best
      ? `<div class="optimizer-results-heading"><strong>Best gear</strong><span>Changes from the best result are highlighted. Equipped: ${baseline.toFixed(2)} DPS.</span></div>
        <div class="optimizer-table-scroll" tabindex="0" role="region" aria-label="Gear optimizer results"><table aria-label="Gear comparison"><thead><tr><th scope="col">Damage <small>vs best</small></th>${slots.map((slot) => `<th scope="col" title="${escapeHtml(slot)}">${SLOT_LABELS[slot] || escapeHtml(slot)}</th>`).join('')}${sets.map((set) => [0, 1].map((slot) => `<th scope="col" title="Set ${set + 1} sigil ${slot + 1}">S${set + 1} Sig${slot + 1}</th>`).join('')).join('')}<th scope="col">Rune</th><th scope="col">Relic</th><th scope="col">Food</th><th scope="col">Utility</th><th scope="col">Infusions</th><th scope="col">&Delta; equipped</th><th scope="col">Apply</th></tr></thead><tbody>${state.winners
          .map((candidate, index) => {
            const equipment = candidate.equipment;
            const difference = candidate.score.dps - baseline;
            const percent = best.score.dps ? (candidate.score.dps / best.score.dps - 1) * 100 : 0;
            return `<tr><td class="optimizer-damage"><strong>${candidate.score.dps.toFixed(2)}</strong>${index ? `<small>${percent.toFixed(1)}%</small>` : '<small>Best</small>'}</td>${slots.map((slot) => equipmentCell(slot, slotPrefix(equipment, slot), slotPrefix(best.equipment, slot), true)).join('')}${sets
              .map((set) =>
                [0, 1]
                  .map((slot) => {
                    const value = equipment.weaponSigils[set][slot];
                    return equipmentCell(
                      `Set ${set + 1} sigil ${slot + 1}`,
                      value,
                      best.equipment.weaponSigils[set][slot],
                      true,
                      SIGIL_DATA[value]?.icon
                    );
                  })
                  .join('')
              )
              .join(
                ''
              )}${equipmentCell('Rune', equipment.rune, best.equipment.rune, true, EQUIPMENT_ICONS[equipment.rune])}${equipmentCell('Relic', equipment.relic, best.equipment.relic, true, (RELIC_DATA as Record<string, { icon?: string }>)[equipment.relic]?.icon)}${equipmentCell('Food', equipment.food, best.equipment.food, false, EQUIPMENT_ICONS[equipment.food])}${equipmentCell('Utility', equipment.utility, best.equipment.utility, false, EQUIPMENT_ICONS[equipment.utility])}${equipmentCell('Infusions', infusions(equipment), infusions(best.equipment))}<td class="optimizer-delta">${difference >= 0 ? '+' : ''}${difference.toFixed(2)}</td><td><button type="button" data-apply="${index}" aria-label="Apply result ${index + 1}">Apply</button></td></tr>${candidate.score.warnings.length ? `<tr class="optimizer-result-warning"><td colspan="${slots.length + sets.length * 2 + 8}">${candidate.score.warnings.map(escapeHtml).join('<br>')}</td></tr>` : ''}`;
          })
          .join('')}</tbody></table></div>`
      : '';
  }

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
  return {
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
