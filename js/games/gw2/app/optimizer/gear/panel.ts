import { openOptimizerBoonChart } from '#gw2/app/optimizer/gear/boon-chart.js';
import {
  OPTIMIZER_RESULT_FILTERS,
  optimizerEquipmentIdentity,
  type OptimizerResultFilter
} from '#gw2/app/optimizer/gear/candidate-results.js';
import { renderOptimizerPreview } from '#gw2/app/optimizer/gear/equipment-preview.js';
import { MAX_OPTIMIZER_WORKERS } from '#gw2/app/optimizer/gear/runner.js';
import {
  applyOptimizerCandidate,
  captureGearOptimizerRequest,
  createOptimizerSpace,
  isOptimizerRequestCurrent,
  OPTIMIZER_OVERCAP_REQUIREMENTS,
  OPTIMIZER_REQUIREMENTS,
  optimizerAppliedCandidate,
  optimizerEquipment,
  optimizerSlots,
  optimizerWeaponSets,
  type GearOptimizerRequest,
  type GearOptimizerSelections,
  type OptimizerCandidate,
  type OptimizerEquipment,
  type OptimizerScore
} from '#gw2/app/optimizer/gear/search.js';
import { EQUIPMENT_ICONS } from '#gw2/app/shared/equipment/icons.js';
import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '#gw2/app/shared/equipment/labels.js';
import { bindCandidatePickers, candidatePicker, updatePicker } from '#gw2/app/shared/equipment/picker.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { FOOD_NAMES } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_NAMES } from '#gw2/platform/equipment/consumables/utilities.js';
import { INFUSION_STATS } from '#gw2/platform/equipment/gear/infusions.js';
import { PREFIXES } from '#gw2/platform/equipment/gear/prefixes/catalog.js';
import { RUNE_NAMES } from '#gw2/platform/equipment/gear/runes.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/catalog.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { escapeHtml } from '#ui/shared/html.js';

const renderedControls = new WeakMap<HTMLElement, { build: ProfessionAppState['build']; key: string }>();

const resultFilters = new WeakMap<GearOptimizerRequest, OptimizerResultFilter[]>();

const ARMOR_SLOTS = ['Helm', 'Shoulders', 'Chest', 'Gloves', 'Leggins', 'Boots'];

// Use compact infusion names in results while keeping the optimizer's underlying stat keys unchanged.
const INFUSION_NAMES: Record<string, string> = {
  Power: 'Mighty',
  Precision: 'Precise',
  'Condition Damage': 'Malign',
  Expertise: 'Spiteful',
  Concentration: 'Mystical',
  'Healing Power': 'Healing',
  Toughness: 'Resilient',
  Vitality: 'Vital'
};

const SLOT_LABELS: Record<string, string> = {
  Helm: 'Helm',
  Shoulders: 'Shld',
  Chest: 'Coat',
  Gloves: 'Gloves',
  Leggins: 'Legs',
  Boots: 'Boots',
  Amulet: 'Amulet',
  Ring1: 'Ring 1',
  Ring2: 'Ring 2',
  Accessory1: 'Acc 1',
  Accessory2: 'Acc 2',
  Back: 'Back',
  Weapon1: 'Main hand',
  Weapon2: 'Off hand',
  AlternateWeapon1: 'Main hand',
  AlternateWeapon2: 'Off hand'
};

/**
 * Keep result cells free of wiki tooltips, with full equipment names in accessible labels. Cells that differ from the
 * equipped setup are marked so each row reads as a set of changes; a group's first column draws the group divider.
 */
function equipmentCell(label: string, value: string, content: string, changed: boolean, groupStart = false): string {
  return `<td class="optimizer-equipment${changed ? ' optimizer-changed' : ''}${groupStart ? ' optimizer-group-start' : ''}" tabindex="0" aria-label="${escapeHtml(`${label}: ${value || 'None'}`)}">${content}</td>`;
}

/**
 * Offer a grouping only when the search compared more than one choice for it; grouping by the whole upgrade set adds
 * nothing unless at least two upgrades vary. Requests are immutable, so each one's groupings are computed once.
 */
function availableResultFilters(request: GearOptimizerRequest, app: ProfessionAppState): OptimizerResultFilter[] {
  let filters = resultFilters.get(request);

  if (!filters) {
    const varying = new Set(
      createOptimizerSpace(request, app.adapter)
        .dimensions.filter(({ choices }) => choices.length > 1)
        .map(({ key }) => (key.startsWith('sigils') ? 'sigils' : key))
    );
    const upgrades = (['sigils', 'rune', 'relic', 'food', 'utility'] as const).filter((key) => varying.has(key));
    filters = ['none', ...(upgrades.length > 1 ? (['all'] as const) : []), ...upgrades];
    resultFilters.set(request, filters);
  }

  return filters;
}

/** A grouping chosen for an earlier search falls back to the top results when the new search cannot offer it. */
function activeResultFilter(
  panel: HTMLElement | null,
  request: GearOptimizerRequest | null,
  app: ProfessionAppState
): OptimizerResultFilter {
  const filter = panel?.dataset.resultFilter as OptimizerResultFilter | undefined;
  return request && filter && availableResultFilters(request, app).includes(filter) ? filter : 'none';
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
    // Apply belongs to the row being previewed, so only that row offers it.
    row.querySelector('[data-apply-row]')?.toggleAttribute('hidden', !selected);

    if (selected) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  });
}

interface UpgradeColumn {
  readonly label: string;
  readonly header: string;
  readonly names: (equipment: OptimizerEquipment) => readonly string[];
  readonly icon: (name: string) => string | undefined;
}

/**
 * Rank candidates against the equipped setup pinned under the header: matching cells recede and changed cells stand
 * out, upgrades every row shares move to one strip above the table, and each gain bar scales to the largest gain in
 * view so near-equal results look near-equal.
 */
function renderResultsTable(
  app: ProfessionAppState,
  request: GearOptimizerRequest,
  candidates: readonly OptimizerCandidate[],
  equipped: OptimizerEquipment,
  equippedScore: OptimizerScore | null | undefined
): string {
  const slots = optimizerSlots(request.build, app.adapter);
  const sets = optimizerWeaponSets(request.build, app.adapter);
  const weaponNames = (set: number): readonly string[] =>
    set === 0 ? request.build.weapons : request.build.alternateWeapons;
  const armor = slots.filter((slot) => ARMOR_SLOTS.includes(slot));
  const trinkets = slots.filter((slot) => !slot.includes('Weapon') && !ARMOR_SLOTS.includes(slot));
  const weapons = sets.flatMap((set) =>
    slots
      .filter((slot) => slot.startsWith(set === 0 ? 'Weapon' : 'AlternateWeapon'))
      .map((slot, hand) => ({ slot, set, hand }))
  );
  const infusionCount = (equipment: OptimizerEquipment, stat: string): number =>
    equipment.infusions.reduce((sum, entry) => sum + (entry.stat === stat ? entry.count : 0), 0);
  const infusionStats = INFUSION_STATS.filter((stat) =>
    [equipped, ...candidates.map(({ equipment }) => equipment)].some((equipment) => infusionCount(equipment, stat))
  );
  const relicIcons = RELIC_DATA as Record<string, { icon?: string }>;
  const upgrades: UpgradeColumn[] = [
    ...sets.map((set) => ({
      label: `${weaponNames(set).filter(Boolean).join(' / ')} sigils`,
      header: `Set ${set + 1} sigils`,
      names: (equipment: OptimizerEquipment) => equipment.weaponSigils[set],
      icon: (name: string) => SIGIL_DATA[name]?.icon
    })),
    { label: 'Rune', header: 'Rune', names: ({ rune }) => [rune], icon: (name) => EQUIPMENT_ICONS[name] },
    { label: 'Relic', header: 'Relic', names: ({ relic }) => [relic], icon: (name) => relicIcons[name]?.icon },
    { label: 'Food', header: 'Food', names: ({ food }) => [food], icon: (name) => EQUIPMENT_ICONS[name] },
    { label: 'Utility', header: 'Utility', names: ({ utility }) => [utility], icon: (name) => EQUIPMENT_ICONS[name] }
  ];
  const describe = (upgrade: UpgradeColumn, equipment: OptimizerEquipment): string =>
    upgrade
      .names(equipment)
      .map((name) => name || 'None')
      .join(' / ');
  const changed = (upgrade: UpgradeColumn, equipment: OptimizerEquipment): boolean =>
    describe(upgrade, equipment) !== describe(upgrade, equipped);
  // An upgrade keeps a column only when some row in view changes it; otherwise the strip names it once.
  const varying = upgrades.filter((upgrade) => candidates.some(({ equipment }) => changed(upgrade, equipment)));
  const shared = upgrades.filter((upgrade) => !varying.includes(upgrade));
  const icon = (upgrade: UpgradeColumn, name: string, size: number, alt: string): string => {
    const source = upgrade.icon(name);
    return source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" width="${size}" height="${size}">` : '';
  };

  const baseline = equippedScore?.dps || 0;
  const largestGain = Math.max(0, ...candidates.map(({ score }) => score.dps - baseline)) || 1;
  const row = (candidate: OptimizerCandidate, index: number, pinned = false): string => {
    const equipment = candidate.equipment;
    const difference = candidate.score.dps - baseline;
    const percent = baseline ? (candidate.score.dps / baseline - 1) * 100 : 0;
    const gain = pinned
      ? ''
      : `<span class="optimizer-gain${difference < 0 ? ' optimizer-loss' : ''}" style="--optimizer-gain: ${((Math.max(0, difference) / largestGain) * 100).toFixed(1)}%"><strong>${difference >= 0 ? '+' : ''}${difference.toFixed(2)}</strong><small>${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%</small></span>`;
    const prefix = (slot: string, groupStart: boolean): string => {
      const value = slotPrefix(equipment, slot);
      return equipmentCell(
        slot,
        value,
        `<span>${escapeHtml((value || 'None').slice(0, 4))}</span>`,
        value !== slotPrefix(equipped, slot),
        groupStart
      );
    };

    const cells = [
      ...armor.map((slot, index) => prefix(slot, index === 0)),
      ...trinkets.map((slot, index) => prefix(slot, index === 0)),
      ...weapons.map(({ slot }, index) => prefix(slot, index === 0)),
      ...infusionStats.map((stat, index) => {
        const count = infusionCount(equipment, stat);
        return equipmentCell(
          `${INFUSION_NAMES[stat] || stat} infusions`,
          String(count),
          `<span>${count}</span>`,
          count !== infusionCount(equipped, stat),
          index === 0
        );
      }),
      ...varying.map((upgrade, index) =>
        equipmentCell(
          upgrade.header,
          describe(upgrade, equipment),
          upgrade
            .names(equipment)
            .map((name) => icon(upgrade, name, 22, name || 'None') || `<span>${escapeHtml(name || 'None')}</span>`)
            .join(''),
          changed(upgrade, equipment),
          index === 0
        )
      )
    ].join('');
    // Generated boons share one compact line, with each percentage opening the optional chart.
    const coverage = (['quickness', 'alacrity'] as const)
      .flatMap((kind) => {
        const measured = candidate.score.boonCoverage?.[kind].allyPercent;

        if (measured === undefined || measured <= 0) return [];

        return [
          `<button type="button" class="optimizer-boon-link" data-boon-preview aria-haspopup="dialog" title="View chart: generated duration for one ally as a percentage of the benchmark window">${kind === 'quickness' ? 'Quickness' : 'Alacrity'} ${measured.toFixed(2)}%</button>`
        ];
      })
      .join('');
    return `<tr tabindex="0" data-preview="${index}"${pinned ? ' class="optimizer-equipped" aria-label="Equipped setup"' : ''}><td class="optimizer-damage"><strong>${candidate.score.dps.toFixed(2)}</strong>${pinned ? '<span class="optimizer-equipped-label">Equipped</span>' : ''}${coverage ? `<div class="optimizer-boon-coverage">${coverage}</div>` : ''}</td><td class="optimizer-gain-cell">${gain}</td>${cells}<td class="optimizer-apply">${pinned ? '' : '<button type="button" data-apply-row hidden>Apply</button>'}</td></tr>`;
  };

  const group = (label: string, span: number): string =>
    span ? `<th scope="colgroup" colspan="${span}" class="optimizer-group-start">${label}</th>` : '';
  const column = (label: string, index: number): string =>
    `<th scope="col"${index === 0 ? ' class="optimizer-group-start"' : ''}>${label}</th>`;
  // Weapon names say which hand each prefix fills, so dual wielding reads differently from two-handed gear.
  const weaponColumns = weapons.map(({ set, hand }, index) => {
    const names = weaponNames(set);
    const twoHanded = app.weaponData[names[0]]?.wielding === '2h';
    return column(
      `${escapeHtml(names[hand])} <span class="optimizer-weapon-hand">${twoHanded ? '2H' : hand === 0 ? 'MH' : 'OH'}</span>`,
      index
    );
  });
  const sharedStrip = shared.length
    ? `<ul class="optimizer-shared" aria-label="Shared by every result">${shared
        .map(
          (upgrade) =>
            `<li><span class="optimizer-shared-label">${escapeHtml(upgrade.label)}</span>${upgrade
              .names(equipped)
              .map(
                (name) =>
                  `<span class="optimizer-shared-value">${icon(upgrade, name, 20, '')}${escapeHtml(name || 'None')}</span>`
              )
              .join('')}</li>`
        )
        .join('')}</ul>`
    : '';

  // The equipped row lives in the sticky header so every result below reads as a change from it.
  return `${sharedStrip}<div class="optimizer-table-scroll" tabindex="0" role="region" aria-label="Gear optimizer results"><table aria-label="Gear comparison"><thead><tr class="optimizer-column-groups"><th scope="col" rowspan="2" class="optimizer-damage">DPS</th><th scope="col" rowspan="2" class="optimizer-gain-cell">vs equipped</th>${group('Armor', armor.length)}${group('Trinkets', trinkets.length)}${group('Weapons', weapons.length)}${group('Infusions', infusionStats.length)}${varying
    .map(
      (upgrade, index) =>
        `<th scope="col" rowspan="2"${index === 0 ? ' class="optimizer-group-start"' : ''}>${upgrade.header}</th>`
    )
    .join(
      ''
    )}<td rowspan="2" class="optimizer-apply"></td></tr><tr>${armor.map((slot, index) => column(SLOT_LABELS[slot], index)).join('')}${trinkets.map((slot, index) => column(SLOT_LABELS[slot], index)).join('')}${weaponColumns.join('')}${infusionStats.map((stat, index) => column(INFUSION_NAMES[stat] || stat, index)).join('')}</tr>${equippedScore ? row({ key: 'equipped', equipment: equipped, score: equippedScore, representedCombinationCount: '1' }, -1, true) : ''}</thead><tbody>${candidates.map((candidate, index) => row(candidate, index)).join('')}</tbody></table></div>`;
}

/** Identifies every input to the rendered equipment controls, so rotation-only edits can retain user search choices. */
function optimizerControlsKey(app: ProfessionAppState): string {
  const { build } = app;
  return JSON.stringify([
    optimizerEquipment(build),
    build.weapons,
    build.alternateWeapons,
    optimizerSlots(build, app.adapter),
    app.relicNames,
    app.patch.id
  ]);
}

/** Keep selectors outside the simulation result subtree so baseline rendering cannot discard an active search. */
export function renderGearOptimizer(app: ProfessionAppState): void {
  const runner = app.gearOptimizerRunner;

  if (!runner || typeof document === 'undefined') return;

  let panel = document.getElementById('gear-optimizer');

  // Clear the outgoing Golem controls when the shared editor is owned by a boss scenario.
  if (app.workspace?.scenario) {
    panel?.remove();
    return;
  }

  const displayedResults = (): OptimizerCandidate[] => {
    const filter = activeResultFilter(panel, runner.request, app);
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
      <div class="optimizer-actions"><div class="optimizer-size"><p data-role="optimizer-total"></p><p id="optimizer-estimate" data-role="optimizer-estimate"></p></div><div class="optimizer-run-controls"><label class="optimizer-search-mode">Search<select name="search" aria-describedby="optimizer-estimate"><option value="fast">Fast</option><option value="exact">Exhaustive</option></select></label><label class="optimizer-worker-count">Workers<input name="workers" aria-label="Workers" type="number" min="1" max="${MAX_OPTIMIZER_WORKERS}" step="1" value="${runner.workerCount}"></label><button type="button" data-role="optimizer-cancel">Cancel</button><button type="submit">Run optimizer</button></div></div></form>
      <div class="optimizer-feedback">
      <div class="optimizer-status-row"><div class="optimizer-status-text"><p data-role="optimizer-status" role="status" aria-live="polite"></p><p data-role="optimizer-counts"></p></div>
      <div class="optimizer-view-controls" data-role="optimizer-view-controls" hidden><div class="optimizer-views" role="group" aria-label="Group results" data-role="optimizer-views"></div><label class="optimizer-changes-toggle"><input type="checkbox" data-role="optimizer-changes-only">Changes only</label></div></div>
      <progress data-role="optimizer-progress" max="100" value="0" aria-label="Optimizer coverage"></progress>
      </div>
      <div data-role="optimizer-results"></div>
      <section data-role="optimizer-preview" class="optimizer-preview" aria-label="Result character" hidden></section>`;
    results.append(panel);
    const form = panel.querySelector('form')!;
    const estimate = (): void => updateSearchSummary(app, form);

    bindCandidatePickers(form);
    // Clearing only slot overrides restores the shared prefix choices and invalidates an active search.
    form.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).closest('[data-clear-forced-slots]')) return;

      form.querySelectorAll<HTMLSelectElement>('[data-forced-slot]').forEach((select) => {
        select.value = '';
      });
      form.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.addEventListener('change', () => {
      runner.cancel();
      estimate();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        if (
          app.analysis.state.simulationStatus !== 'idle' ||
          app.analysis.state.resultRevision !== app.analysis.state.buildRevision
        )
          throw new Error('Wait for the current build simulation to finish.');

        const request = captureGearOptimizerRequest(app, readSelections(form), readSearchMode(form));
        app.analysis.cancelDistribution();
        app.analysis.cancelModifiers();
        runner.run(request, Number(new FormData(form).get('workers')));
      } catch (error) {
        panel!.querySelector<HTMLElement>('.optimizer-feedback')!.hidden = false;
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(
          error instanceof Error ? error.message : error
        );
      }
    });
    panel.querySelector('[data-role="optimizer-cancel"]')!.addEventListener('click', () => runner.cancel());
    // Groupings only change the displayed rows; the completed search and equipped build stay intact.
    panel.querySelector('[data-role="optimizer-views"]')!.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-result-filter]');

      if (!button) return;

      panel!.dataset.resultFilter = button.dataset.resultFilter;
      renderGearOptimizer(app);
      panel!.querySelector<HTMLElement>(`[data-result-filter="${button.dataset.resultFilter}"]`)?.focus();
    });
    // Hiding unchanged cells is presentation only, so it survives result refreshes without re-rendering rows.
    panel.querySelector('[data-role="optimizer-changes-only"]')!.addEventListener('change', (event) => {
      panel!.classList.toggle('optimizer-changes-only', (event.target as HTMLInputElement).checked);
    });
    // Apply equips the chosen gear only while its search is finished and still matches the build.
    const applyCandidate = (request: GearOptimizerRequest, candidate: OptimizerCandidate): void => {
      if (runner.request !== request || !['complete', 'canceled'].includes(runner.state.status)) return;

      try {
        applyOptimizerCandidate(app, request, candidate);
        renderGearOptimizer(app);
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(error);
      }
    };

    const selectResult = (event: MouseEvent | KeyboardEvent): void => {
      const element = event.target as HTMLElement;

      if (event instanceof KeyboardEvent) {
        if (element.closest('button') || !['Enter', ' '].includes(event.key)) return;

        event.preventDefault();
      }

      const row = element.closest<HTMLElement>('[data-preview]');

      if (!row || !runner.request) return;

      const request = runner.request;
      const index = Number(row.dataset.preview);
      const applied = optimizerAppliedCandidate(app, runner.request);
      const candidate =
        index < 0
          ? {
              key: 'equipped',
              equipment: applied?.equipment || optimizerEquipment(runner.request.build),
              score: applied?.score || runner.state.baseline!,
              representedCombinationCount: '1'
            }
          : displayedResults()[index];

      if (!candidate) return;

      // Inspection uses the captured search and never selects or applies the row's equipment.
      const boonButton = element.closest<HTMLElement>('[data-boon-preview]');

      if (boonButton) {
        openOptimizerBoonChart(request, candidate, boonButton);
        return;
      }

      // The row's Apply acts on that row's candidate, which is always the one being previewed.
      if (element.closest('[data-apply-row]')) {
        applyCandidate(request, candidate);
        return;
      }

      try {
        panel!.dataset.selectedKey = candidate.key;
        updatePreviewSelection(panel!, displayedResults());
        renderOptimizerPreview(
          panel!.querySelector<HTMLElement>('[data-role="optimizer-preview"]')!,
          app,
          request,
          candidate,
          request.build.startingWeaponSet,
          // Apply the gear actually being previewed, even if the visible grouping has changed.
          () => applyCandidate(request, candidate)
        );
      } catch (error) {
        panel!.querySelector('[data-role="optimizer-status"]')!.textContent = String(error);
      }
    };

    panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!.addEventListener('click', selectResult);
    panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!.addEventListener('keydown', selectResult);
  }

  // Rotation edits invalidate searches, but equipment controls only depend on their choices and usable weapon slots.
  // Those inputs change only with a new build or revision, so search-progress and filter renders reuse the prior key.
  const build = app.build;
  const revisionChanged = panel.dataset.revision !== String(app.analysis.state.buildRevision);
  const previousControls = renderedControls.get(panel);
  const controlsKey =
    revisionChanged || previousControls?.build !== build ? optimizerControlsKey(app) : previousControls.key;
  const controlsChanged = previousControls?.build !== build || previousControls.key !== controlsKey;

  if (controlsChanged) {
    renderedControls.set(panel, { build, key: controlsKey });
    const slots = optimizerSlots(build, app.adapter);
    // Seed actual choices so adding alternatives preserves the equipped options in the search.
    const prefixes = [...new Set(slots.map((slot) => slotPrefix(build, slot) || build.gear[`Weapon${slot.at(-1)}`]))];
    const infusionStats = [...new Set(build.infusions.filter((entry) => entry.count).map((entry) => entry.stat))];
    // Each usable weapon set gets its own row so both sigil slots sit beside the weapons they upgrade.
    const sigilRows = [build.weapons, build.alternateWeapons].map((weapons, set) =>
      !optimizerWeaponSets(build, app.adapter).includes(set)
        ? ''
        : searchRow(
            `sigils${set + 1}`,
            `Weapon set ${set + 1}`,
            [0, 1]
              .map((slot) => {
                const current = build.weaponSigils[set][slot];
                return candidatePicker(
                  `sigil${set + 1}-${slot + 1}`,
                  `Set ${set + 1} sigil ${slot + 1}`,
                  SIGIL_NAMES,
                  [current],
                  { describe: sigilOptionLabel, heading: `Sigil ${slot + 1}`, equipped: [current] }
                );
              })
              .join(''),
            { detail: weapons.filter(Boolean).join(' / ') }
          )
    );
    const upgradePicker = (key: 'rune' | 'relic' | 'food' | 'utility', label: string, names: readonly string[]) => {
      const current = build[key] || '';
      return candidatePicker(key, label, ['', ...names], [current], {
        limit: key === 'food' || key === 'utility' ? 3 : 0,
        describe: {
          rune: runeOptionLabel,
          relic: relicOptionLabel,
          food: foodOptionLabel,
          utility: utilityOptionLabel
        }[key],
        equipped: [current]
      });
    };

    // Keep the two coverage inputs together, separated from attributes checked before simulation.
    const requirementFields = (overcap: boolean): string =>
      Object.entries(OPTIMIZER_REQUIREMENTS)
        .filter(([key]) => key in OPTIMIZER_OVERCAP_REQUIREMENTS === overcap)
        .map(
          ([key, label]) =>
            `<label class="optimizer-field">${label}<input name="${key}" data-constraint-label="${label}" type="number" min="0" ${key.endsWith('DurationPercent') ? 'max="100"' : ''} step="any" placeholder="No limit"></label>`
        )
        .join('');
    const forcedFields = slots
      .map((slot) => {
        // Use only usable weapon slots, with set labels that distinguish alternate equipment.
        const label = slot.includes('Weapon')
          ? `Set ${slot.startsWith('Alternate') ? 2 : 1} ${SLOT_LABELS[slot].toLowerCase()}`
          : ({ Chest: 'Coat', Leggins: 'Leggings', Back: 'Back item' } as Record<string, string>)[slot] ||
            slot.replace(/(\d)$/, ' $1');
        return `<label class="optimizer-field">${escapeHtml(label)}<select name="force-${slot}" data-forced-slot="${slot}" data-constraint-label="${escapeHtml(label)}"><option value="">Any prefix</option>${PREFIXES.map((prefix) => `<option value="${escapeHtml(prefix)}">${escapeHtml(prefixOptionLabel(prefix))}</option>`).join('')}</select></label>`;
      })
      .join('');
    // Rows follow the character's equipment order; constraints close the list as one summarized disclosure.
    panel.querySelector('[data-role="optimizer-controls"]')!.innerHTML = `<div class="optimizer-space">
      ${searchRow(
        'prefixes',
        'Equipment stats',
        candidatePicker('prefixes', 'Prefixes', PREFIXES, prefixes, {
          limit: 3,
          describe: prefixOptionLabel,
          emptyLabel: 'Keep all current prefixes',
          equipped: prefixes
        }),
        { counter: 'prefixes' }
      )}
      ${searchRow('rune', 'Rune', upgradePicker('rune', 'Rune sets', RUNE_NAMES))}
      ${searchRow('relic', 'Relic', upgradePicker('relic', 'Relics', app.relicNames))}
      ${sigilRows.join('')}
      ${searchRow('food', 'Food', upgradePicker('food', 'Food', FOOD_NAMES), { counter: 'food' })}
      ${searchRow('utility', 'Utility', upgradePicker('utility', 'Utility', UTILITY_NAMES), { counter: 'utility' })}
      ${searchRow(
        'infusions',
        'Infusions',
        `${candidatePicker('infusionStats', 'Infusion stats', INFUSION_STATS, infusionStats, {
          limit: 2,
          emptyLabel: 'Choose stats to change the infusion total',
          equipped: infusionStats
        })}<label class="optimizer-infusion-count">Total slots<input name="infusionCount" aria-label="Total infusions" type="number" min="0" max="18" step="1" value="${build.infusions.reduce((sum, entry) => sum + entry.count, 0)}"></label>`,
        { counter: 'infusionStats' }
      )}
      <details class="optimizer-constraints"><summary><span>Constraints</span><span class="optimizer-constraint-list" data-role="optimizer-constraints"></span></summary>
        <div class="optimizer-constraint-body">
          <fieldset><legend>Requirements</legend><div class="optimizer-requirements"><div class="optimizer-requirement-grid">${requirementFields(false)}</div><div class="optimizer-requirement-grid optimizer-overcap-requirements">${requirementFields(true)}</div><p class="optimizer-overcap-help">generated seconds / benchmark seconds &gt;= 1 + minimum overcap / 100</p></div></fieldset>
          <fieldset><legend>Forced slots</legend><div class="optimizer-field-grid">${forcedFields}</div><button type="button" data-clear-forced-slots>Clear forced slots</button></fieldset>
        </div>
      </details></div>`;
    panel.querySelectorAll<HTMLElement>('[data-picker]').forEach(updatePicker);
  }

  if (revisionChanged || controlsChanged) {
    panel.dataset.revision = String(app.analysis.state.buildRevision);

    updateSearchSummary(app, panel.querySelector('form')!);
  }

  const state = runner.state;
  const applied = runner.request && optimizerAppliedCandidate(app, runner.request);
  const equippedScore = applied?.score || state.baseline;
  panel.querySelector<HTMLElement>('.optimizer-feedback')!.hidden = state.status === 'idle';
  const stale = runner.request !== null && !isOptimizerRequestCurrent(app, runner.request);
  // Keep current gear visible before a search and restore it when the build or search changes.
  const preview = panel.querySelector<HTMLElement>('[data-role="optimizer-preview"]')!;
  const previewRequest = `${runner.request?.revision}:${state.started}`;

  if (
    preview.dataset.request !== previewRequest ||
    preview.dataset.revision !== String(app.analysis.state.buildRevision)
  ) {
    preview.dataset.request = previewRequest;
    preview.dataset.revision = String(app.analysis.state.buildRevision);
    panel.dataset.selectedKey = 'equipped';
    renderOptimizerPreview(preview, app, {
      build: app.build,
      patch: app.patch
    });
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
  // Rejections include illegal sigil combinations as well as unmet stat requirements.
  panel.querySelector('[data-role="optimizer-counts"]')!.textContent = state.count
    ? runner.request?.search === 'fast'
      ? `${state.completed.toLocaleString()} candidates checked.${state.completed !== state.simulations ? ` ${state.simulations.toLocaleString()} simulations; ${(state.completed - state.simulations).toLocaleString()} rejected by sigil rules or requirements.` : ''}`
      : `${state.completed.toLocaleString()} / ${state.count.toLocaleString()} candidates checked.${state.completed !== state.simulations ? ` ${(state.completed - state.simulations).toLocaleString()} rejected by sigil rules or requirements.` : ''}`
    : '';

  // Keep optimizer feedback focused on search status and rankings; simulation warnings stay in result data.
  const list = panel.querySelector<HTMLElement>('[data-role="optimizer-results"]')!;
  const candidates = displayedResults();
  const filter = activeResultFilter(panel, runner.request, app);
  const signature = JSON.stringify([
    state.status,
    runner.request?.revision,
    equippedScore?.dps,
    applied?.key,
    state.winners[0]?.key,
    filter,
    candidates.map((winner) => [winner.key, winner.equipment, winner.score.dps])
  ]);

  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    const request = runner.request;
    const best = candidates[0] || state.winners[0];
    const filters = request ? availableResultFilters(request, app) : [];
    const views = panel.querySelector<HTMLElement>('[data-role="optimizer-views"]')!;
    panel.querySelector<HTMLElement>('[data-role="optimizer-view-controls"]')!.hidden = !best;
    views.hidden = filters.length < 2;
    views.innerHTML = filters
      .map(
        (key) =>
          `<button type="button" class="optimizer-view" data-result-filter="${key}" aria-pressed="${key === filter}">${OPTIMIZER_RESULT_FILTERS[key]}</button>`
      )
      .join('');
    list.innerHTML =
      best && request
        ? renderResultsTable(
            app,
            request,
            candidates,
            applied?.equipment || optimizerEquipment(request.build),
            equippedScore
          )
        : state.status === 'complete'
          ? '<p>No evaluated candidate met the requirements. A fast search may miss qualifying combinations.</p>'
          : '';
  }

  updatePreviewSelection(panel, candidates);
  // The preview and the selected row share one Apply rule: finished, current searches only.
  panel.querySelectorAll<HTMLButtonElement>('[data-apply], [data-apply-row]').forEach((button) => {
    button.disabled = stale || !['complete', 'canceled'].includes(state.status);
  });
  (panel.querySelector('[data-role="optimizer-cancel"]') as HTMLButtonElement).disabled = !runner.isRunning;
  (panel.querySelector('[data-role="optimizer-cancel"]') as HTMLButtonElement).hidden = !runner.isRunning;
  // Optimization needs a rotation to compare gear damage.
  (panel.querySelector('button[type="submit"]') as HTMLButtonElement).disabled =
    runner.isRunning || !app.build.rotation.length;
  panel.querySelector<HTMLInputElement>('input[name="workers"]')!.disabled = runner.isRunning;
  panel.querySelector<HTMLSelectElement>('select[name="search"]')!.disabled = runner.isRunning;
}

/** Keep search strategy separate from equipment and capture the selected mode for the entire worker job. */
function readSearchMode(form: HTMLFormElement): 'fast' | 'exact' {
  const mode = form.querySelector<HTMLSelectElement>('select[name="search"]')!.value;

  if (mode !== 'fast' && mode !== 'exact') throw new TypeError('Invalid optimizer search mode.');

  return mode;
}

/** One searched item per row: its name, the candidate chips, and the factor it adds to the search size. */
function searchRow(key: string, label: string, body: string, { detail = '', counter = '' } = {}): string {
  return `<div class="optimizer-row" role="group" aria-labelledby="optimizer-row-${key}"><div class="optimizer-row-label"><span id="optimizer-row-${key}">${escapeHtml(label)}</span>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}${counter ? `<small data-picker-count="${counter}"></small>` : ''}</div><div class="optimizer-row-body">${body}</div><span class="optimizer-multiplier" data-multiplier="${key}"></span></div>`;
}

/**
 * Refresh everything derived from the current choices: capped-picker counts, active constraints, each row's
 * multiplier, and the raw combination total. Multipliers come from the same search space the workers build, so
 * forced slots and illegal sigil pairs are already reflected.
 */
function updateSearchSummary(app: ProfessionAppState, form: HTMLFormElement): void {
  form.querySelectorAll<HTMLElement>('[data-picker-count]').forEach((counter) => {
    const picker = form.querySelector<HTMLElement>(`[data-picker="${counter.dataset.pickerCount}"]`)!;
    const count = picker.querySelectorAll('input[type="hidden"]').length;
    counter.textContent = `${count}/${picker.dataset.limit}`;
    counter.classList.toggle('optimizer-count-full', count >= Number(picker.dataset.limit));
  });
  // List every active requirement and forced slot in the summary, so a collapsed section never hides a filter.
  form.querySelector('[data-role="optimizer-constraints"]')!.innerHTML = [
    ...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-constraint-label]')
  ]
    .filter((field) => field.value.trim())
    .map(
      (field) =>
        `<span class="optimizer-constraint">${escapeHtml(`${field.dataset.constraintLabel}: ${field.value.trim()}`)}</span>`
    )
    .join('');

  const estimate = form.querySelector('[data-role="optimizer-estimate"]')!;
  const total = form.querySelector<HTMLElement>('[data-role="optimizer-total"]')!;
  const multipliers = form.querySelectorAll<HTMLElement>('[data-multiplier]');
  multipliers.forEach((element) => {
    element.textContent = '';
  });
  total.textContent = '';
  try {
    const request = captureGearOptimizerRequest(app, readSelections(form), readSearchMode(form));
    const space = createOptimizerSpace(request, app.adapter);
    // Every prefix slot is its own dimension; the stats row reports their product.
    const prefixSlots = new Set(optimizerSlots(request.build, app.adapter));
    const sizes = new Map<string, bigint>();
    for (const { key, choices } of space.dimensions) {
      const row = prefixSlots.has(key) ? 'prefixes' : key;
      sizes.set(row, (sizes.get(row) ?? 1n) * BigInt(choices.length));
    }

    multipliers.forEach((element) => {
      const size = sizes.get(element.dataset.multiplier!) ?? 1n;
      element.textContent = `×${size.toLocaleString()}`;
      element.classList.toggle('optimizer-multiplier-one', size === 1n);
    });
    // Counting distinct stat totals can exceed the preparation limit, so the summary states the merge instead.
    total.innerHTML = `<strong>${space.rawCount.toLocaleString()}</strong> ${space.rawCount === 1n ? 'combination' : 'combinations'} before merging equal stats`;
    estimate.textContent =
      request.search === 'exact'
        ? 'Exhaustive evaluates every distinct combination of your selected gear.'
        : 'Fast samples and refines candidates. It may miss the best combination.';
  } catch (error) {
    estimate.textContent = String(error instanceof Error ? error.message : error);
  }
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
    // Blank slots follow the shared candidates; explicit overrides remain active while collapsed.
    forcedSlots: Object.fromEntries(
      [...form.querySelectorAll<HTMLSelectElement>('[data-forced-slot]')]
        .filter((select) => select.value)
        .map((select) => [select.dataset.forcedSlot!, select.value])
    ),
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
