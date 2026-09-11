import { bindDropdownSearch } from '#ui/shared/dropdown-search.js';
import { escapeHtml as esc, gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import { isSlotSkillSelectable } from '#gw2/app/build/state/skill-selection.js';

import type { ProfessionSkillBarGroup } from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { ProfessionSlotLoadoutBar, ProfessionSlotLoadoutSelector } from '#gw2/app/build/types.js';
import { requiredElement } from '#ui/shared/dom.js';

/** Lists the legal, deduplicated choices for a heal, utility, or elite slot. */
export function availableSlotSkills(app: ProfessionAppState, type: string): Skill[] {
  const spec = app.adapter.eliteSpecialization(app.build);
  const byDisplayName = new Map<string, Skill>();
  for (const skill of app.skills) {
    if (
      skill.type !== type ||
      !isSlotSkillSelectable(app, skill, spec) ||
      (skill.specialization && skill.specialization !== spec) ||
      !app.adapter.isSkillAvailable(skill, {
        build: app.build,
        specialization: spec
      })
    ) {
      continue;
    }

    const displayName = String(skill.displayName || skill.name);
    if (!byDisplayName.has(displayName)) byDisplayName.set(displayName, skill);
  }

  return [...byDisplayName.values()];
}

/** Resolves the armed member of a selected skill's flip chain for display. */
export function skillBarDisplaySkill(
  app: ProfessionAppState,
  selected: Skill | null | undefined
): Skill | null | undefined {
  if (!selected) return selected;
  const professionState = app.results?.endState?.profession as SchedulerRecord | undefined;
  const availableFlips = professionState?.availableFlips;
  if (!availableFlips || typeof availableFlips !== 'object') return selected;
  const flips = availableFlips as Record<string, unknown>;
  const visited = new Set<number>();
  let current = selected;
  let display = selected;
  while (current.flipSkillId != null && !visited.has(Number(current.id))) {
    visited.add(Number(current.id));
    const flip = app.skillById.get(Number(current.flipSkillId));
    if (!flip || flip.flipParentId !== current.id) break;
    if (flips[flip.id] ?? flips[flip.name]) display = flip;
    current = flip;
  }

  return display;
}

/** Renders a profession group containing multiple independently selectable slots. */
function multiSelectionInspectionGroupHtml(app: ProfessionAppState, group: ProfessionSkillBarGroup): string {
  const selectionSlots = (group.selections || [])
    .map((selection) => {
      const optionSkills = (selection.optionSkillIds || [])
        .map((id) => app.skillById.get(Number(id)))
        .filter((skill) => skill != null);
      const options = selection.optionEntries?.length
        ? selection.optionEntries
        : optionSkills.map((skill) => ({
            value: String(skill.id),
            label: skill.name,
            icon: skill.icon,
            description: skill.description,
            skillId: skill.id
          }));
      const selectedEntry = selection.optionEntries?.find(
        (entry) => String(entry.value) === String(selection.selectionValue)
      );
      const selectedSkill = app.skillById.get(Number(selection.skillId));
      const display = selectedEntry
        ? {
            name: selectedEntry.label,
            icon: selectedEntry.icon,
            description: selectedEntry.description
          }
        : selectedSkill;
      if (!display || !options.length) return '';
      return `<div class="skill-bar-inspection-slot selectable"
          data-selection-key="${esc(selection.selectionKey)}"
          data-selection-index="${selection.selectionIndex}">
          <button type="button" class="sbar-icon" aria-label="Change ${esc(group.label)} ${selection.selectionIndex + 1}" title="${esc(`${display.name}\n${gw2ApiText(display.description)}`)}">
              <img src="${esc(display.icon || '')}" alt="">
          </button>
          <div class="sbar-arrow">&#9660;</div>
          <div class="sbar-dropdown" data-search-label="${esc(selection.filterPlaceholder || `Search ${group.label}`)}">${options
            .map(
              (option) =>
                `<button type="button" class="dd-item" data-selection-value="${esc(option.value)}"${
                  option.skillId == null ? '' : ` data-skill-id="${esc(option.skillId)}"`
                }>
                  <img src="${esc(option.icon || '')}" alt="">
                  <span>${esc(option.label)}</span>
              </button>`
            )
            .join('')}</div>
      </div>`;
    })
    .join('');
  return `<div class="skill-bar-inspection-group${
    group.className ? ` ${esc(group.className)}` : ''
  }" style="--inspection-color:${esc(group.color || 'var(--accent)')}">
      <span class="skill-bar-inspection-label">${esc(group.label)}</span>
      <div class="skill-bar-inspection-skills">${selectionSlots}</div>
  </div>`;
}

/** Renders slot skills plus profession-specific build selectors or Revenant legends. */
export function renderSkills(app: ProfessionAppState): void {
  const spec = app.adapter.eliteSpecialization(app.build);
  const skillBar = requiredElement('skill-bar');

  // Revenant legends own the complete selectable-skills panel.
  if (app.adapter.slotLoadout) {
    skillBar.classList.remove('has-inspection');
    renderFixedSlotLoadout(app, spec);
    return;
  }

  const context = {
    build: app.build,
    specialization: spec,
    catalog: app.activeCatalog,
    professionState: app.results?.endState?.profession,
    traits: new Set((app.attributeData?.activeTraits || []).flatMap((trait) => [trait.id, trait.name]))
  };
  // Profession contracts now expose only editable build selectors here.
  const inspectionGroups = app.profession.ui.skillBarGroups?.(context) || [];
  skillBar.classList.toggle('has-inspection', inspectionGroups.length > 0);

  const slots: readonly (readonly [string, string])[] = [
    ['Heal', 'Heal'],
    ['Utility1', 'Utility'],
    ['Utility2', 'Utility'],
    ['Utility3', 'Utility'],
    ['Elite', 'Elite']
  ];

  // Compact icon buttons edit equipped slots above traits without adding rotation casts.
  const selectedSkillBarHtml = slots
    .map(([key, type]) => {
      const current = app.skillByName.get(app.build.selectedSkills[key]);
      const display = skillBarDisplaySkill(app, current);
      return `<div class="skill-bar-slot ${type === 'Elite' ? 'elite-border' : ''}" data-key="${key}">
                <button type="button" class="sbar-icon" aria-label="Change ${key.replace(/(\d)$/, ' $1').toLowerCase()} skill" title="${esc(display?.displayName || display?.name || 'Choose skill')}"><img src="${esc(display?.icon || '')}" alt=""><span class="sbar-icon-arrow" aria-hidden="true">▼</span></button>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${availableSlotSkills(app, type)
                  .map(
                    (skill) =>
                      `<button type="button" class="dd-item" data-name="${esc(skill.name)}" aria-pressed="${skill.name === current?.name}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.displayName || skill.name)}</span></button>`
                  )
                  .join('')}</div>
            </div>`;
    })
    .join('');
  const inspectionLayout = inspectionGroups.find((group) => group.layout)?.layout || '';

  const selectedSkillsHtml = `<div class="skill-bar-selected">${selectedSkillBarHtml}</div>`;
  const professionSelectionsHtml = `<div class="skill-bar-inspection${
    inspectionLayout ? ` ${esc(inspectionLayout)}` : ''
  }"${inspectionLayout ? ` data-layout="${esc(inspectionLayout)}"` : ''}>${inspectionGroups
    .map((group) => multiSelectionInspectionGroupHtml(app, group))
    .join('')}</div>`;

  // Keep build-changing profession selectors while omitting static mechanic previews.
  skillBar.innerHTML = `${selectedSkillsHtml}${
    inspectionGroups.length ? `<section class="profession-build-selections">${professionSelectionsHtml}</section>` : ''
  }`;

  bindSkillDropdowns(skillBar);
  // Apply standard slot choices through the existing build update path.
  skillBar.querySelectorAll('.skill-bar-slot[data-key]').forEach((slot) => {
    if (!(slot instanceof HTMLElement)) return;
    slot.querySelectorAll('.dd-item').forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.addEventListener('click', () => {
        const key = slot.dataset.key;
        const name = item.dataset.name;
        if (!key || !name) return;
        // Swap an already-equipped skill into this slot without duplicating it or losing the previous pick.
        const conflict = Object.keys(app.build.selectedSkills).find(
          (other) => other !== key && app.build.selectedSkills[other] === name
        );
        if (conflict) app.build.selectedSkills[conflict] = app.build.selectedSkills[key];
        app.build.selectedSkills[key] = name;
        app.changed();
        skillBar.querySelector<HTMLElement>(`[data-key="${key}"] .sbar-icon`)?.focus();
      });
    });
  });

  // Profession selectors share search controls while retaining their own build contracts.
  skillBar.querySelectorAll('.skill-bar-inspection-slot[data-selection-key]').forEach((slot) => {
    if (!(slot instanceof HTMLElement)) return;
    slot.querySelectorAll('.dd-item').forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        const key = slot.dataset.selectionKey;
        const index = Number(slot.dataset.selectionIndex);
        const rawSkillId = item.dataset.skillId;
        const skillId = Number(rawSkillId);
        const value = item.dataset.selectionValue;
        if (
          !key ||
          !Number.isInteger(index) ||
          (rawSkillId == null && value == null) ||
          (rawSkillId != null && !Number.isFinite(skillId))
        ) {
          return;
        }

        if (app.profession.ui.updateSkillBarSelection) {
          app.profession.ui.updateSkillBarSelection(
            {
              build: app.build,
              specialization: spec,
              professionState: app.results?.endState?.profession,
              catalog: app.activeCatalog
            },
            {
              key,
              index,
              ...(rawSkillId == null ? {} : { skillId }),
              ...(value == null ? {} : { value })
            }
          );
        } else if (rawSkillId != null) {
          const values = Array.isArray(app.build[key]) ? [...app.build[key]] : [];
          values[index] = skillId;
          app.build[key] = values;
        }

        app.changed();
      });
    });
  });
}

/** Renders profession-defined fixed slot bars and their loadout selectors. */
function renderFixedSlotLoadout(app: ProfessionAppState, spec: string): void {
  const loadout = app.adapter.slotLoadout;
  if (!loadout) return;
  const context = {
    build: app.build,
    specialization: spec,
    professionState: app.results?.endState?.profession,
    catalog: app.activeCatalog
  };
  const view = loadout.view(context);
  const skillBar = requiredElement('skill-bar');
  // Name the retained legend selectors independently of their hidden, fixed skill rows.
  const title = skillBar.parentElement?.querySelector('.selectable-skills-title');
  if (title) title.textContent = view.label;

  // Keep Revenant slots icon-only
  const slotHtml = (skill: Skill, index: number, child = false): string => {
    return `<div class="skill-bar-slot fixed-loadout-skill${
      child ? ' child-skill' : ''
    }${!child && index === 4 ? ' elite-border' : ''}">
        <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}"><img src="${esc(skill.icon || '')}" alt=""></div>
    </div>`;
  };

  // Render a fixed root skill together with its profession-defined children.
  const barSkillHtml = (skill: Skill, index: number): string => {
    const childIds = typeof loadout.skillChildren === 'function' ? loadout.skillChildren(context, skill.id) : [];
    const children = childIds
      .map((id) => app.skillById.get(Number(id)))
      .filter((child): child is Skill => child != null);
    return `<div class="fixed-loadout-skill-stack">
        ${slotHtml(skill, index)}
        ${children
          .map(
            (child) =>
              `<div class="fixed-loadout-chain-step">
                <span class="weapon-chain-arrow" aria-hidden="true">&#8627;</span>
                ${slotHtml(child, index, true)}
              </div>`
          )
          .join('')}
      </div>`;
  };

  // Render one complete fixed loadout bar and its active-state styling.
  const barHtml = (bar: ProfessionSlotLoadoutBar): string =>
    `<div class="fixed-loadout-bar skill-bar-selected${
      view.formatActiveBar ? (bar.active ? ' active' : ' inactive') : ' static'
    }">
        ${bar.skillIds
          .map((id) => app.skillById.get(Number(id)))
          .filter((skill): skill is Skill => skill != null)
          .map(barSkillHtml)
          .join('')}
      </div>`;

  // Legend portraits open the existing choices; names remain available to tooltips and assistive technology.
  const selectorHtml = (selector: ProfessionSlotLoadoutSelector, index: number): string => {
    if (view.selectionControl === 'icons') {
      const selected = selector.options.find((entry) => entry.value === selector.value);
      return `<div class="skill-bar-slot fixed-loadout-icon-selector">
          <button type="button" class="fixed-loadout-trigger sbar-icon"
            data-loadout-toggle aria-expanded="false"
            aria-label="Change ${esc(selector.label.toLowerCase())}: ${esc(selected?.label || 'Choose loadout')}"
            title="${esc(selected?.label || 'Choose loadout')}"
            aria-haspopup="listbox" aria-controls="fixed-loadout-menu-${index}">
            <img src="${esc(selected?.icon || '')}" alt="">
            <span class="fixed-loadout-trigger-arrow" aria-hidden="true">&#9660;</span>
          </button>
          <div id="fixed-loadout-menu-${index}" class="sbar-dropdown fixed-loadout-dropdown"><div role="listbox">
            ${selector.options
              .map(
                (entry) =>
                  `<button type="button" class="dd-item fixed-loadout-option${
                    entry.value === selector.value ? ' selected' : ''
                  }" data-loadout-key="${esc(selector.key)}"
                    data-loadout-value="${esc(entry.value)}" role="option"
                    aria-selected="${entry.value === selector.value}"${entry.disabled ? ' disabled' : ''}>
                    <img src="${esc(entry.icon || '')}" alt="">
                    <span>${esc(entry.label)}</span>
                </button>`
              )
              .join('')}
          </div></div>
        </div>`;
    }

    return `<label><span>${esc(selector.label)}</span>
                <select class="gear-select" data-loadout-key="${esc(selector.key)}">
                    ${selector.options
                      .map(
                        (entry) =>
                          `<option value="${esc(entry.value)}"${entry.value === selector.value ? ' selected' : ''}${entry.disabled ? ' disabled' : ''}>${esc(entry.label)}</option>`
                      )
                      .join('')}
                </select>
            </label>`;
  };

  const pairedIconLoadout = view.selectionControl === 'icons' && view.selectors.length === view.bars.length;

  // Pair icon selectors with their bars when the profession exposes parallel sets.
  const fixedLoadoutHtml = pairedIconLoadout
    ? `<div class="fixed-loadout-pairs">${view.selectors
        .map(
          (selector, index) =>
            `<div class="fixed-loadout-pair">
              ${selectorHtml(selector, index)}
              ${barHtml(view.bars[index])}
          </div>`
        )
        .join('')}</div>`
    : `<div class="fixed-loadout-selectors">
          ${view.selectors.map(selectorHtml).join('')}
      </div>${view.bars.map(barHtml).join('')}`;
  // Render Revenant's legend selectors directly in the selectable-skills panel.
  skillBar.innerHTML = fixedLoadoutHtml;

  bindSkillDropdowns(skillBar);

  // Apply changes from native loadout selects.
  skillBar.querySelectorAll('select[data-loadout-key]').forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      const key = select.dataset.loadoutKey;
      if (!key) return;
      loadout.updateBuild(app.build, key, select.value, context);
      app.changed();
    });
  });

  // Apply changes from icon-based loadout options.
  skillBar.querySelectorAll('button[data-loadout-key]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = button.dataset.loadoutKey;
      const value = button.dataset.loadoutValue;
      if (!key || value === undefined) return;
      loadout.updateBuild(app.build, key, value, context);
      app.changed();
    });
  });
}

/** Every editable skill, pet and legend menu uses the same search and keyboard behavior. */
function bindSkillDropdowns(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.sbar-dropdown').forEach((menu) => {
    const trigger = menu.parentElement!.querySelector<HTMLElement>('.sbar-icon')!;
    trigger.setAttribute('aria-expanded', 'false');
    bindDropdownSearch(
      trigger,
      menu,
      '.dd-item',
      () => {
        root.querySelectorAll<HTMLElement>('.sbar-dropdown.open').forEach((other) => {
          other.classList.remove('open');
          other.parentElement?.querySelector('.sbar-icon')?.setAttribute('aria-expanded', 'false');
        });
        menu.classList.add('open');
      },
      () => menu.classList.remove('open'),
      menu.dataset.searchLabel || 'Search skills'
    );
  });
}
