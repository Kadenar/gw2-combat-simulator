import { optionHtml } from '#ui/shared/select-options.js';
import { escapeHtml as esc } from '#ui/shared/html.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import { assumptionControlsForSpecialization } from '#gw2/platform/builds/assumptions.js';
import { isSimulationRandomnessControl } from '#gw2/platform/builds/randomness-assumptions.js';
import {
  normalizeTargetArmor,
  STACKING_TARGET_CONDITIONS,
  TARGET_ARMOR_OPTIONS,
  TARGET_CONDITION_GROUPS
} from '#gw2/app/build/panels/metadata.js';
import { requiredInput, requiredSelect } from '#ui/shared/dom.js';
import { mountProcRateOverrides } from '#gw2/app/build/panels/proc-rates.js';

import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  ProfessionAssumptionControl,
  ProfessionAssumptionOption,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';
import { clamp } from '#kernel/core/numeric.js';

const PERMANENT_BOONS: readonly (readonly [string, string])[] = [
  ['fury', 'Fury'],
  ['protection', 'Protection'],
  ['resolution', 'Resolution'],
  ['regeneration', 'Regeneration'],
  ['swiftness', 'Swiftness'],
  ['vigor', 'Vigor'],
  ['aegis', 'Aegis']
];

interface EffectItemOptions {
  readonly name: string;
  readonly checked: boolean;
  readonly type: string;
  readonly key?: string;
  readonly stacks?: number | null;
}

export function renderAssumptions(app: ProfessionAppState): void {
  const a = app.build.assumptions as ProfessionBuildAssumptions;
  const targetArmorValue = normalizeTargetArmor(app.build.targetArmor);
  const targetArmorPreset = TARGET_ARMOR_OPTIONS.some((option) => option.value === targetArmorValue)
    ? String(targetArmorValue)
    : 'custom';
  app.build.targetArmor = targetArmorValue;
  const container = document.getElementById('perma-boons');
  if (!container) throw new Error('Required assumptions panel is missing.');
  const expandedSections = new Map<string, boolean>(
    Array.from(
      container.querySelectorAll<HTMLDetailsElement>('details[data-assumption-section]'),
      (section) => [section.dataset.assumptionSection || '', section.open] as const
    )
  );
  const assumptionControls = assumptionControlsForSpecialization(
    app.adapter.assumptionControls,
    app.adapter.eliteSpecialization(app.build)
  );
  const conditions = (a.targetConditions ||= {});
  const section = (key: string, label: string, contents: string): string =>
    `<details class="perma-group" data-assumption-section="${esc(key)}"${expandedSections.get(key) !== false ? ' open' : ''}>
        <summary class="perma-group-label">${esc(label)}</summary>
        <div class="perma-group-content">${contents}</div>
    </details>`;
  // Named simulation effects stay readable without hover cards obscuring adjacent controls.
  const item = ({ name, checked, type, key = name, stacks = null }: EffectItemOptions): string =>
    `<label class="perma-item">
            <input type="checkbox" aria-label="${esc(name)}" data-effect-type="${type}" data-effect-key="${esc(key)}"${checked ? ' checked' : ''}>
            <img class="perma-icon" src="${esc(MODIFIER_EFFECT_ICONS[name])}" alt="">
            <span class="perma-name">${esc(name)}</span>
            ${stacks == null ? '' : `<input type="number" class="perma-stacks" aria-label="${esc(`${name} stacks`)}" data-effect-type="${type}" data-effect-key="${esc(key)}" min="0" max="25" value="${stacks}"${checked ? '' : ' disabled'}>`}
        </label>`;
  const boonItems = [
    item({
      name: 'Might',
      checked: Number(a.might) > 0,
      type: 'boon',
      key: 'might',
      stacks: clamp(Number(a.might) || 0, 0, 25)
    }),
    ...PERMANENT_BOONS.map(([key, name]) =>
      item({
        name,
        checked: !!a[key],
        type: 'boon',
        key
      })
    )
  ].join('');
  // Fixed simulation boons remain visibly checked but cannot be changed by the user.
  const fixedBoonItems = `<div class="perma-fixed-boons">
    <label class="perma-item">
      <input type="checkbox" aria-label="Quickness" checked disabled>
      <img class="perma-icon" src="${esc(MODIFIER_EFFECT_ICONS.Quickness)}" alt="">
      <span>Quickness<small>Always active</small></span>
    </label>
    <label class="perma-item">
      <input type="checkbox" aria-label="Alacrity" checked disabled>
      <img class="perma-icon" src="${esc(MODIFIER_EFFECT_ICONS.Alacrity)}" alt="">
      <span>Alacrity<small>Always active</small></span>
    </label>
  </div>`;
  const conditionGroups = TARGET_CONDITION_GROUPS.map((group) => {
    const conditionItems = group.conditions
      .map((name) => {
        const stackable = STACKING_TARGET_CONDITIONS.has(name);
        const value = conditions[name];
        return item({
          name,
          checked: stackable ? Number(value) > 0 : !!value,
          type: 'condition',
          stacks: stackable ? clamp(Number(value) || 0, 0, 25) : null
        });
      })
      .join('');
    const label = group.label === 'Damaging' ? 'Conditions' : group.label;
    return section(
      `conditions-${group.label.toLowerCase()}`,
      label,
      `<div class="perma-effect-grid">${conditionItems}</div>`
    );
  }).join('');
  const assumptionOptionIcon = (option: ProfessionAssumptionOption): string =>
    option.icon || app.skillById.get(Number(option.skillId))?.icon || '';
  const professionAssumptionItem = (control: ProfessionAssumptionControl): string => {
    const value = a[control.key] ?? control.defaultValue;
    if (control.type === 'boolean') {
      return `<label class="boon-control"><input data-assumption-key="${esc(control.key)}" type="checkbox"${value ? ' checked' : ''}> ${esc(control.label)}</label>`;
    }

    if (control.type === 'select') {
      const hasIcons = control.options.some(assumptionOptionIcon);
      if (hasIcons) {
        const selected = control.options.find((option) => option.value === String(value)) || control.options[0];
        if (!selected) return '';
        return `<div class="boon-control assumption-icon-control">
                        <span>${esc(control.label)}</span>
                        <details class="assumption-icon-select">
                            <summary>
                                <img src="${esc(assumptionOptionIcon(selected))}" alt="">
                                <span>${esc(selected.label)}</span>
                            </summary>
                            <div class="assumption-icon-options" role="listbox"
                                aria-label="${esc(control.label)}">
                                ${control.options
                                  .map(
                                    (option) =>
                                      `<button type="button" role="option"
                                        aria-selected="${option.value === String(value)}"
                                        data-assumption-option-key="${esc(control.key)}"
                                        data-assumption-option-value="${esc(option.value)}">
                                        <img src="${esc(assumptionOptionIcon(option))}" alt="">
                                        <span>${esc(option.label)}</span>
                                    </button>`
                                  )
                                  .join('')}
                            </div>
                        </details>
                    </div>`;
      }

      const select = `<select id="assumption-${esc(control.key)}" class="gear-select" data-assumption-key="${esc(control.key)}"${control.key === 'criticalDamageMode' ? ' aria-describedby="critical-damage-help"' : ''}>
                        ${control.options
                          .map(
                            (option) =>
                              `<option value="${esc(option.value)}"${String(value) === option.value ? ' selected' : ''}>${esc(option.label)}</option>`
                          )
                          .join('')}
                    </select>`;
      if (control.key === 'criticalDamageMode') {
        // Keep the everyday explanation short; expose the full mode distinction only on request.
        return `<div class="boon-control critical-damage-control">
          <label for="assumption-criticalDamageMode">Critical damage</label>
          <div class="critical-damage-picker">${select}
            <details id="critical-damage-details">
              <summary aria-label="About critical damage">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6" />
                  <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </summary>
              <div class="critical-damage-description">
                <p><strong>Averaged:</strong> Every hit includes its expected critical damage, smoothing out crit luck for comparisons. Critical Yes/No still records the roll used for on-critical effects.</p>
                <p><strong>Rolled:</strong> A successful critical roll deals extra damage; a failed roll deals normal damage.</p>
                <p>RNG simulations always use Rolled. The same inputs and seed reproduce the same outcomes.</p>
              </div>
            </details>
          </div>
          <p id="critical-damage-help">${value === 'rolled' ? 'Uses individual critical rolls for each hit.' : 'Uses expected critical damage for consistent comparisons.'}</p>
        </div>`;
      }

      return `<label class="boon-control">${esc(control.label)}${select}</label>`;
    }

    return `<label class="boon-control">${esc(control.label)}
                <input data-assumption-key="${esc(control.key)}" type="number"
                    min="${control.minimum}" max="${control.maximum}" step="${control.step}" value="${Number(value)}">
            </label>`;
  };

  const professionAssumptionItems = assumptionControls
    .filter((control) => !control.section || control.section === 'target')
    .map(professionAssumptionItem)
    .join('');
  const simulationAssumptionItems = assumptionControls
    .filter((control) => control.section === 'simulation' && !isSimulationRandomnessControl(control))
    .map(professionAssumptionItem)
    .join('');
  const customAssumptionSections = new Map<string, ProfessionAssumptionControl[]>();
  assumptionControls
    .filter((control) => !!control.section && !['target', 'simulation'].includes(control.section))
    .forEach((control) => {
      const section = control.section;
      if (!section) return;
      const controls = customAssumptionSections.get(section) || [];
      controls.push(control);
      customAssumptionSections.set(section, controls);
    });
  const customAssumptionGroups = Array.from(customAssumptionSections)
    .map(([sectionName, controls]) =>
      section(
        `custom-${sectionName.toLowerCase().replaceAll(' ', '-')}`,
        sectionName,
        controls.map(professionAssumptionItem).join('')
      )
    )
    .join('');
  container.innerHTML = `
            ${section('boons', 'Effects', `<div class="perma-boon-label">Boons</div><div class="perma-effect-grid">${boonItems}</div>${fixedBoonItems}`)}
            ${conditionGroups}
            ${section(
              'target',
              'Target',
              `
                <label class="boon-control">Maximum HP <input id="target-hp" type="number" min="0" step="100000" value="${Number(app.build.targetHealth)}"></label>
                <label class="boon-control">Starting health % <input id="target-starting-health-percent" type="number" min="0" max="100" step="1" value="${Number(app.build.targetStartingHealthPercent ?? 100)}"></label>
                <label class="boon-control">Target armor
                    <select class="gear-select" id="target-armor-preset">
                        ${TARGET_ARMOR_OPTIONS.map(({ value, label }) =>
                          optionHtml(String(value), targetArmorPreset, `${label} (${value})`)
                        ).join('')}
                        ${optionHtml('custom', targetArmorPreset, 'Custom…')}
                    </select>
                    <input id="target-armor" type="number" min="1" value="${targetArmorValue}" aria-label="Custom target armor"${targetArmorPreset === 'custom' ? '' : ' hidden'}>
                </label>
                <label class="boon-control">Skill activations/s <input id="target-skill-activations" type="number" min="0" max="10" step="0.1" value="${a.targetSkillActivationsPerSecond}"></label>
                <label class="boon-control"><input id="target-moving" type="checkbox"${a.targetMoving ? ' checked' : ''}> Moving</label>
                ${professionAssumptionItems}
            `
            )}
            ${customAssumptionGroups}
            ${section(
              'party',
              'Party',
              `
                <label class="boon-control">Additional allied players <input id="allied-player-count" type="number" min="0" max="4" step="1" value="${Number(a.alliedPlayerCount || 0)}"></label>
            `
            )}
            ${section(
              'simulation',
              'Simulation',
              `
                <label class="boon-control">Time of day
                    <select class="gear-select" id="time-of-day">
                        <option value="day"${a.timeOfDay === 'night' ? '' : ' selected'}>Day</option>
                        <option value="night"${a.timeOfDay === 'night' ? ' selected' : ''}>Night</option>
                    </select>
                </label>
                <label class="boon-control" title="Controls minions, clones, turrets, and other ordinary summons. Mesmer phantasms and the Mechanist mech are unchanged.">
                    <input id="share-player-boons-with-summons" type="checkbox"${a.sharePlayerBoonsWithSummons !== false ? ' checked' : ''}>
                    Share player boons with summons
                </label>
                ${simulationAssumptionItems}
            `
            )}`;

  // Hover and keyboard focus preview the explanation; clicking keeps it open for reading.
  const criticalDetails = container.querySelector<HTMLDetailsElement>('#critical-damage-details');
  const criticalSummary = criticalDetails?.querySelector('summary');
  if (criticalDetails && criticalSummary) {
    let pinned = false;
    criticalDetails.addEventListener('pointerenter', () => {
      criticalDetails.open = true;
    });
    criticalDetails.addEventListener('pointerleave', () => {
      if (!pinned && !criticalDetails.contains(document.activeElement)) criticalDetails.open = false;
    });
    criticalSummary.addEventListener('focus', () => {
      criticalDetails.open = true;
    });
    criticalSummary.addEventListener('click', (event) => {
      event.preventDefault();
      criticalDetails.open = pinned = !pinned;
    });
    criticalDetails.addEventListener('focusout', () => {
      criticalDetails.open = pinned = false;
    });
    criticalDetails.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      criticalDetails.open = pinned = false;
    });
  }

  container.querySelectorAll('input[type="checkbox"][data-effect-type]').forEach((check) => {
    if (!(check instanceof HTMLInputElement)) return;
    check.addEventListener('change', () => {
      const { effectType, effectKey } = check.dataset;
      if (!effectType || !effectKey) return;
      const stackInput = container.querySelector<HTMLInputElement>(
        `input[type="number"][data-effect-type="${effectType}"][data-effect-key="${effectKey}"]`
      );
      if (stackInput) {
        stackInput.disabled = !check.checked;
        if (check.checked && Number(stackInput.value) < 1) {
          stackInput.value = '1';
        }
      }

      const value = stackInput ? (check.checked ? Math.max(1, Number(stackInput.value) || 1) : 0) : check.checked;
      if (effectType === 'boon') {
        a[effectKey] = value;
      } else if (value) {
        conditions[effectKey] = value;
      } else {
        delete conditions[effectKey];
      }

      app.changed();
    });
  });
  container.querySelectorAll('input[type="number"][data-effect-type]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('change', () => {
      const value = clamp(Number(input.value) || 0, 0, 25);
      const { effectType, effectKey } = input.dataset;
      if (!effectType || !effectKey) return;
      input.value = String(value);
      if (effectType === 'boon') {
        a[effectKey] = value;
      } else if (value) {
        conditions[effectKey] = value;
      } else {
        delete conditions[effectKey];
      }

      app.changed();
    });
  });
  const targetSkillActivations = requiredInput('target-skill-activations');
  targetSkillActivations.addEventListener('change', () => {
    a.targetSkillActivationsPerSecond = clamp(Number(targetSkillActivations.value) || 0, 0, 10);
    app.changed();
  });
  const targetMoving = requiredInput('target-moving');
  targetMoving.addEventListener('change', () => {
    a.targetMoving = targetMoving.checked;
    app.changed();
  });
  const alliedPlayerCount = requiredInput('allied-player-count');
  alliedPlayerCount.addEventListener('change', () => {
    a.alliedPlayerCount = clamp(Math.trunc(Number(alliedPlayerCount.value) || 0), 0, 4);
    app.changed();
  });
  const sharePlayerBoonsWithSummons = requiredInput('share-player-boons-with-summons');
  sharePlayerBoonsWithSummons.addEventListener('change', () => {
    a.sharePlayerBoonsWithSummons = sharePlayerBoonsWithSummons.checked;
    app.changed();
  });
  const timeOfDay = requiredSelect('time-of-day');
  timeOfDay.addEventListener('change', () => {
    a.timeOfDay = timeOfDay.value === 'night' ? 'night' : 'day';
    app.changed();
  });
  container.querySelectorAll('[data-assumption-key]').forEach((control) => {
    if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLSelectElement)) {
      return;
    }

    control.addEventListener('change', () => {
      const definition = assumptionControls.find((candidate) => candidate.key === control.dataset.assumptionKey);
      if (!definition) return;
      if (definition.type === 'boolean') {
        if (!(control instanceof HTMLInputElement)) return;
        a[definition.key] = control.checked;
      } else if (definition.type === 'number') {
        a[definition.key] = clamp(Number(control.value) || 0, definition.minimum, definition.maximum);
      } else {
        a[definition.key] = control.value;
      }

      app.changed();
    });
  });
  container.querySelectorAll('[data-assumption-option-key]').forEach((option) => {
    if (!(option instanceof HTMLButtonElement)) return;
    option.addEventListener('click', () => {
      const definition = assumptionControls.find((candidate) => candidate.key === option.dataset.assumptionOptionKey);
      const value = option.dataset.assumptionOptionValue;
      if (
        !definition ||
        definition.type !== 'select' ||
        value === undefined ||
        !definition.options.some((candidate) => candidate.value === value)
      )
        return;
      a[definition.key] = value;
      app.changed();
    });
  });
  const targetHealth = requiredInput('target-hp');
  targetHealth.addEventListener('change', () => {
    app.build.targetHealth = Math.max(0, Number(targetHealth.value) || 0);
    targetHealth.value = String(app.build.targetHealth);
    app.changed();
  });
  const targetStartingHealthPercent = requiredInput('target-starting-health-percent');
  targetStartingHealthPercent.addEventListener('change', () => {
    app.build.targetStartingHealthPercent = clamp(Number(targetStartingHealthPercent.value) || 0, 0, 100);
    targetStartingHealthPercent.value = String(app.build.targetStartingHealthPercent);
    app.changed();
  });
  const targetArmorPresetSelect = requiredSelect('target-armor-preset');
  const targetArmor = requiredInput('target-armor');
  targetArmorPresetSelect.addEventListener('change', () => {
    const customSelected = targetArmorPresetSelect.value === 'custom';
    targetArmor.hidden = !customSelected;
    if (customSelected) {
      targetArmor.focus();
      return;
    }

    app.build.targetArmor = normalizeTargetArmor(targetArmorPresetSelect.value);
    targetArmor.value = String(app.build.targetArmor);
    app.changed();
  });
  targetArmor.addEventListener('change', () => {
    app.build.targetArmor = normalizeTargetArmor(targetArmor.value);
    targetArmor.value = String(app.build.targetArmor);
    app.changed();
  });
  mountProcRateOverrides(app, expandedSections.get('proc-rates') !== false);
}
