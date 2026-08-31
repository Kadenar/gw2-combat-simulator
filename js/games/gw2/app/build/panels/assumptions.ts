import { escapeHtml as esc, option } from '#gw2/app/presentation/shared/html.js';
import { assumptionControlsForSpecialization } from '#gw2/app/profession/assumptions.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/rotation/shared/icons.js';
import { isSimulationRandomnessControl } from '#gw2/app/simulation/randomness.js';
import {
  normalizeTargetArmor,
  STACKING_TARGET_CONDITIONS,
  TARGET_ARMOR_OPTIONS,
  TARGET_CONDITION_GROUPS
} from '#gw2/app/build/panels/options.js';
import { requiredInput, requiredSelect } from '#ui/shared/dom.js';

import type {
  ProfessionAppState,
  ProfessionAssumptionControl,
  ProfessionAssumptionOption,
  ProfessionBuildAssumptions
} from '#gw2/app/types.js';

const PERMANENT_BOONS: readonly (readonly [string, string])[] = [
  ['fury', 'Fury'],
  ['quickness', 'Quickness'],
  ['alacrity', 'Alacrity'],
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

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
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
  const item = ({ name, checked, type, key = name, stacks = null }: EffectItemOptions): string =>
    `<label class="perma-item" title="${esc(name)}">
            <input type="checkbox" aria-label="${esc(name)}" data-effect-type="${type}" data-effect-key="${esc(key)}"${checked ? ' checked' : ''}>
            <img class="perma-icon" src="${esc(MODIFIER_EFFECT_ICONS[name])}" alt="">
            ${stacks == null ? '' : `<input type="number" class="perma-stacks" aria-label="${esc(`${name} stacks`)}" data-effect-type="${type}" data-effect-key="${esc(key)}" min="0" max="25" value="${stacks}"${checked ? '' : ' disabled'}>`}
        </label>`;
  const boonItems = [
    item({
      name: 'Might',
      checked: Number(a.might) > 0,
      type: 'boon',
      key: 'might',
      stacks: Math.max(0, Math.min(25, Number(a.might) || 0))
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
  const conditionGroups = TARGET_CONDITION_GROUPS.map((group) => {
    const conditionItems = group.conditions
      .map((name) => {
        const stackable = STACKING_TARGET_CONDITIONS.has(name);
        const value = conditions[name];
        return item({
          name,
          checked: stackable ? Number(value) > 0 : !!value,
          type: 'condition',
          stacks: stackable ? Math.max(0, Math.min(25, Number(value) || 0)) : null
        });
      })
      .join('');
    const label = group.label === 'Damaging' ? 'Conditions' : group.label;
    return section(`conditions-${group.label.toLowerCase()}`, label, conditionItems);
  }).join('');
  const assumptionOptionIcon = (option: ProfessionAssumptionOption): string =>
    option.icon || app.skillById.get(Number(option.skillId))?.icon || '';
  const professionAssumptionItem = (control: ProfessionAssumptionControl): string => {
    const value = a[control.key] ?? control.defaultValue;
    if (control.type === 'boolean') {
      return `<label class="boon-control"><input data-assumption-key="${esc(control.key)}" data-assumption-type="boolean" type="checkbox"${value ? ' checked' : ''}> ${esc(control.label)}</label>`;
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

      return `<label class="boon-control">${esc(control.label)}
                    <select class="gear-select" data-assumption-key="${esc(control.key)}" data-assumption-type="select">
                        ${control.options
                          .map(
                            (option) =>
                              `<option value="${esc(option.value)}"${String(value) === option.value ? ' selected' : ''}>${esc(option.label)}</option>`
                          )
                          .join('')}
                    </select>
                </label>`;
    }

    return `<label class="boon-control">${esc(control.label)}
                <input data-assumption-key="${esc(control.key)}" data-assumption-type="number" type="number"
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
            ${section('boons', 'Boons', boonItems)}
            ${conditionGroups}
            ${section(
              'target',
              'Target',
              `
                <label class="boon-control">Target HP <input id="target-hp" type="number" min="0" step="100000" value="${Number(app.build.targetHealth)}"></label>
                <label class="boon-control">Target armor
                    <select class="gear-select" id="target-armor-preset">
                        ${TARGET_ARMOR_OPTIONS.map(({ value, label }) =>
                          option(String(value), targetArmorPreset, `${label} (${value})`)
                        ).join('')}
                        ${option('custom', targetArmorPreset, 'Custom…')}
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
      const value = Math.max(0, Math.min(25, Number(input.value) || 0));
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
    a.targetSkillActivationsPerSecond = Math.max(0, Math.min(10, Number(targetSkillActivations.value) || 0));
    app.changed();
  });
  const targetMoving = requiredInput('target-moving');
  targetMoving.addEventListener('change', () => {
    a.targetMoving = targetMoving.checked;
    app.changed();
  });
  const alliedPlayerCount = requiredInput('allied-player-count');
  alliedPlayerCount.addEventListener('change', () => {
    a.alliedPlayerCount = Math.max(0, Math.min(4, Math.trunc(Number(alliedPlayerCount.value) || 0)));
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
        a[definition.key] = Math.max(definition.minimum, Math.min(definition.maximum, Number(control.value) || 0));
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
}
