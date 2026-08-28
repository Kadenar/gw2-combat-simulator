import { escapeHtml as esc, gw2ApiText } from '../../presentation/shared/html.js';
import { isSlotSkillSelectable } from '../state/skill-selection.js';

import type { ProfessionSkillBarGroup, SchedulerRecord, Skill, SkillId } from '../../../platform/engine/types.js';
import type { ProfessionAppState, ProfessionSlotLoadoutBar, ProfessionSlotLoadoutSelector } from '../../types.js';
import { requiredElement } from '../../../../../ui/shared/dom.js';

const RANGER_BUILD_SELECTION_GROUP_IDS = new Set([
  'ranger-pet-1-selection',
  'ranger-pet-2-selection',
  'ranger-hammer-selection'
]);

/** Retains only profession groups that change build state after removing mechanic previews. */
export function selectableSkillBarGroups(
  professionId: string,
  groups: readonly ProfessionSkillBarGroup[]
): ProfessionSkillBarGroup[] {
  return professionId === 'ranger'
    ? groups.filter((group) => RANGER_BUILD_SELECTION_GROUP_IDS.has(String(group.id)))
    : [];
}

/** Lists the legal, deduplicated choices for a heal, utility, or elite slot. */
export function availableSlotSkills(app: ProfessionAppState, type: string): Skill[] {
  const spec = app.adapter.eliteSpecialization(app.build);
  const byDisplayName = new Map<string, Skill>();
  for (const skill of app.skills) {
    if (
      skill.implemented === false ||
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

export interface SkillBarInspectionStack {
  readonly root: Skill;
  readonly children: readonly Skill[];
}

/** Groups inspection skills into a root skill followed by its chain children. */
export function skillBarInspectionStacks(
  skills: readonly Skill[],
  inspectionChainRoots: Readonly<Record<string, SkillId>> = {}
): SkillBarInspectionStack[] {
  const visibleSkillIds = new Set(skills.map((skill) => Number(skill.id)));
  const childrenByRoot = new Map<number, Skill[]>();
  const childSkillIds = new Set<number>();

  for (const skill of skills) {
    const rootId = Number(inspectionChainRoots[String(skill.id)] ?? skill.chainRoot);
    if (!Number.isFinite(rootId) || rootId === Number(skill.id) || !visibleSkillIds.has(rootId)) {
      continue;
    }

    if (!childrenByRoot.has(rootId)) childrenByRoot.set(rootId, []);
    childrenByRoot.get(rootId)?.push(skill);
    childSkillIds.add(Number(skill.id));
  }

  return skills
    .filter((skill) => !childSkillIds.has(Number(skill.id)))
    .map((root) => ({
      root,
      children: (childrenByRoot.get(Number(root.id)) || []).sort(
        (left, right) =>
          Number(left.chainStep ?? Number.MAX_SAFE_INTEGER) - Number(right.chainStep ?? Number.MAX_SAFE_INTEGER)
      )
    }));
}

/** Renders one read-only skill icon inside a profession inspection group. */
function inspectionSkillSlotHtml(skill: Skill, child = false): string {
  return `<div class="skill-bar-inspection-slot${child ? ' child-skill' : ''}">
      <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}">
          <img src="${esc(skill.icon || '')}" alt="">
      </div>
  </div>`;
}

/** Renders root skills with any chained follow-up skills nested beneath them. */
function inspectionSkillStacksHtml(
  skills: readonly Skill[],
  inspectionChainRoots?: Readonly<Record<string, SkillId>>
): string {
  return skillBarInspectionStacks(skills, inspectionChainRoots)
    .map(
      ({ root, children }) =>
        `<div class="skill-bar-inspection-skill-stack">
          ${inspectionSkillSlotHtml(root)}
          ${children
            .map(
              (child) =>
                `<div class="skill-bar-inspection-chain-step">
                  <span class="weapon-chain-arrow" aria-hidden="true">&#8627;</span>
                  ${inspectionSkillSlotHtml(child, true)}
                </div>`
            )
            .join('')}
        </div>`
    )
    .join('');
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
      const leadingSkills = (selection.leadingSkillIds || [])
        .map((id) => app.skillById.get(Number(id)))
        .filter((skill): skill is Skill => skill != null);
      const associatedSkills = (selection.skillIds || [])
        .map((id) => app.skillById.get(Number(id)))
        .filter((skill): skill is Skill => skill != null);
      const display = selectedEntry
        ? {
            name: selectedEntry.label,
            icon: selectedEntry.icon,
            description: selectedEntry.description
          }
        : selectedSkill;
      if (!display || !options.length) return '';
      const labeled = Boolean(selection.keyLabel || selection.typeLabel);
      const selectionSlot = `<div class="skill-bar-inspection-slot selectable${labeled ? ' labeled-skill-bar-slot' : ''}"
          data-selection-key="${esc(selection.selectionKey)}"
          data-selection-index="${selection.selectionIndex}">
          <div class="sbar-icon" title="${esc(`${display.name}\n${gw2ApiText(display.description)}`)}">
              <img src="${esc(display.icon || '')}" alt="">
              ${labeled ? '<span class="sbar-icon-arrow" aria-hidden="true">&#9660;</span>' : ''}
          </div>
          ${selection.keyLabel ? `<span class="skill-bar-key">${esc(selection.keyLabel)}</span>` : ''}
          ${selection.typeLabel ? `<span class="skill-bar-type">${esc(selection.typeLabel)}</span>` : ''}
          <div class="sbar-arrow">&#9660;</div>
          <div class="sbar-dropdown">${
            selection.filterPlaceholder
              ? `<input class="sbar-dropdown-filter" type="search" placeholder="${esc(selection.filterPlaceholder)}" aria-label="${esc(selection.filterPlaceholder)}" autocomplete="off" spellcheck="false">`
              : ''
          }${options
            .map(
              (option) =>
                `<div class="dd-item" data-selection-value="${esc(option.value)}"${
                  option.skillId == null ? '' : ` data-skill-id="${esc(option.skillId)}"`
                }>
                  <img src="${esc(option.icon || '')}" alt="">
                  <span>${esc(option.label)}</span>
              </div>`
            )
            .join('')}${
            selection.filterPlaceholder
              ? '<div class="dd-empty sbar-dropdown-filter-empty" hidden>No matching options</div>'
              : ''
          }</div>
      </div>`;
      return leadingSkills.length || associatedSkills.length
        ? `<div class="skill-bar-inspection-selection">
            ${inspectionSkillStacksHtml(leadingSkills)}${selectionSlot}${inspectionSkillStacksHtml(associatedSkills)}
          </div>`
        : selectionSlot;
    })
    .join('');
  const skillSlots = group.skillIds
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  return `<div class="skill-bar-inspection-group${
    group.className ? ` ${esc(group.className)}` : ''
  }" style="--inspection-color:${esc(group.color || 'var(--accent)')}">
      <span class="skill-bar-inspection-label">${esc(group.label)}</span>
      <div class="skill-bar-inspection-skills">${selectionSlots}${inspectionSkillStacksHtml(skillSlots, group.inspectionChainRoots)}</div>
  </div>`;
}

/** Renders build-selectable slot skills plus Ranger pets/hammer or Revenant legends. */
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
  const inspectionGroups =
    app.profession.id === 'ranger'
      ? selectableSkillBarGroups('ranger', app.profession.ui.skillBarGroups?.(context) || [])
      : [];
  skillBar.classList.toggle('has-inspection', inspectionGroups.length > 0);

  const slots: readonly (readonly [string, string])[] = [
    ['Heal', 'Heal'],
    ['Utility1', 'Utility'],
    ['Utility2', 'Utility'],
    ['Utility3', 'Utility'],
    ['Elite', 'Elite']
  ];

  // Keep selectable slots icon-only; heal and elite borders provide the useful distinction without captions.
  const selectedSkillBarHtml = slots
    .map(([key, type]) => {
      const current = app.skillByName.get(app.build.selectedSkills[key]);
      const display = skillBarDisplaySkill(app, current);
      return `<div class="skill-bar-slot ${type === 'Heal' ? 'heal-border' : type === 'Elite' ? 'elite-border' : ''}" data-key="${key}">
                <div class="sbar-icon" title="${esc(display?.displayName || display?.name || 'Choose skill')}"><img src="${esc(display?.icon || '')}" alt=""><span class="sbar-icon-arrow" aria-hidden="true">▼</span></div>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${availableSlotSkills(app, type)
                  .map(
                    (skill) =>
                      `<div class="dd-item" data-name="${esc(skill.name)}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.displayName || skill.name)}</span></div>`
                  )
                  .join('')}</div>
            </div>`;
    })
    .join('');
  const inspectionLayout = inspectionGroups.find((group) => group.layout)?.layout || '';

  const selectedSkillsHtml = `<div class="skill-bar-selected">${selectedSkillBarHtml}</div>`;
  const rangerSelectionsHtml = `<div class="skill-bar-inspection${
    inspectionLayout ? ` ${esc(inspectionLayout)}` : ''
  }"${inspectionLayout ? ` data-layout="${esc(inspectionLayout)}"` : ''}>${inspectionGroups
    .map((group) => multiSelectionInspectionGroupHtml(app, group))
    .join('')}</div>`;

  // Ranger pet and Hammer selections remain build inputs; static profession mechanics do not.
  skillBar.innerHTML = `${selectedSkillsHtml}${
    inspectionGroups.length ? `<section class="ranger-build-selections">${rangerSelectionsHtml}</section>` : ''
  }`;

  // Wire dropdown selection for the standard heal, utility, and elite slots.
  skillBar.querySelectorAll('.skill-bar-slot[data-key]').forEach((slot) => {
    if (!(slot instanceof HTMLElement)) return;
    const icon = slot.querySelector('.sbar-icon');
    const dropdown = slot.querySelector('.sbar-dropdown');
    if (!icon || !dropdown) return;
    const toggleDropdown = (event: Event) => {
      event.stopPropagation();
      document.querySelectorAll('.sbar-dropdown.open').forEach((drop) => {
        if (drop !== dropdown) drop.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    };

    icon.addEventListener('click', toggleDropdown);
    slot.querySelectorAll('.dd-item').forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.addEventListener('click', () => {
        const key = slot.dataset.key;
        const name = item.dataset.name;
        if (!key || !name) return;
        app.build.selectedSkills[key] = name;
        app.changed();
      });
    });
  });

  // Wire profession inspection selectors, including optional text filtering.
  skillBar.querySelectorAll('.skill-bar-inspection-slot[data-selection-key]').forEach((slot) => {
    if (!(slot instanceof HTMLElement)) return;
    const icon = slot.querySelector('.sbar-icon');
    const dropdown = slot.querySelector('.sbar-dropdown');
    if (!icon || !dropdown) return;
    const filterInput = dropdown.querySelector('.sbar-dropdown-filter');
    const filterEmpty = dropdown.querySelector('.sbar-dropdown-filter-empty');
    const filterOptions = () => {
      if (!(filterInput instanceof HTMLInputElement)) return;
      const query = filterInput.value.trim().toLocaleLowerCase();
      let visibleOptions = 0;
      dropdown.querySelectorAll<HTMLElement>('.dd-item').forEach((item) => {
        const label = item.querySelector('span')?.textContent || '';
        const visible = label.toLocaleLowerCase().includes(query);
        item.hidden = !visible;
        if (visible) visibleOptions += 1;
      });
      if (filterEmpty instanceof HTMLElement) {
        filterEmpty.hidden = visibleOptions > 0;
      }
    };

    if (filterInput instanceof HTMLInputElement) {
      filterInput.addEventListener('input', filterOptions);
      filterInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        dropdown.classList.remove('open');
        filterInput.blur();
      });
    }

    icon.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.sbar-dropdown.open').forEach((drop) => {
        if (drop !== dropdown) {
          drop.classList.remove('open');
        }
      });
      const opening = !dropdown.classList.contains('open');
      dropdown.classList.toggle('open', opening);
      if (opening && filterInput instanceof HTMLInputElement) {
        filterInput.value = '';
        filterOptions();
        filterInput.focus();
      }
    });
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

  // Keep Revenant slots icon-only; borders still distinguish heal and elite skills without redundant captions.
  const slotHtml = (skill: Skill, index: number, child = false): string => {
    return `<div class="skill-bar-slot fixed-loadout-skill${
      child ? ' child-skill' : ''
    }${!child && index === 0 ? ' heal-border' : ''}${!child && index === 4 ? ' elite-border' : ''}">
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

  // Render icon dropdowns without a redundant heading because each trigger already names the legend action.
  const selectorHtml = (selector: ProfessionSlotLoadoutSelector, index: number): string => {
    if (view.selectionControl === 'icons') {
      const selected = selector.options.find((entry) => entry.value === selector.value);
      return `<div class="skill-bar-slot fixed-loadout-icon-selector">
          <button type="button" class="fixed-loadout-trigger"
            data-loadout-toggle aria-expanded="false"
            aria-haspopup="listbox" aria-controls="fixed-loadout-menu-${index}">
            <img src="${esc(selected?.icon || '')}" alt="">
            <span class="fixed-loadout-trigger-copy">
              <strong>${esc(selected?.label || 'Choose loadout')}</strong>
              <small>Change ${esc(selector.label.toLowerCase())}</small>
            </span>
            <span class="fixed-loadout-trigger-arrow" aria-hidden="true">&#9660;</span>
          </button>
          <div id="fixed-loadout-menu-${index}" class="sbar-dropdown fixed-loadout-dropdown" role="listbox">
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
          </div>
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

  // Wire icon-selector dropdown toggles and keyboard dismissal.
  skillBar.querySelectorAll('button[data-loadout-toggle]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const dropdown = button.parentElement?.querySelector('.fixed-loadout-dropdown');
    if (!(dropdown instanceof HTMLElement)) return;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = !dropdown.classList.contains('open');
      document.querySelectorAll<HTMLElement>('.fixed-loadout-dropdown.open').forEach((other) => {
        if (other === dropdown) return;
        other.classList.remove('open');
        other.parentElement?.querySelector('button[data-loadout-toggle]')?.setAttribute('aria-expanded', 'false');
      });
      dropdown.classList.toggle('open', opening);
      button.setAttribute('aria-expanded', String(opening));
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      dropdown.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    });
  });

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
