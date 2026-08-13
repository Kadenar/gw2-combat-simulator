import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";
import { isSlotSkillSelectable } from "./selection.js";

import type {
  ProfessionSkillBarGroup,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type {
  ProfessionAppState,
  ProfessionSlotLoadoutBar,
  ProfessionSlotLoadoutSelector,
} from "../profession/types.js";
import {
  groupWeaponSkillsByAttunement,
  weaponBarSkillStacks,
} from "../profession/weapon-attunement-groups.js";

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required skill panel #${id} is missing.`);
  return element;
}

/**
 * @param {ProfessionAppState} app
 * @param {string} type
 * @returns {Skill[]}
 */
export function availableSlotSkills(
  app: ProfessionAppState,
  type: string,
): Skill[] {
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
        specialization: spec,
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
  selected: Skill | null | undefined,
): Skill | null | undefined {
  if (!selected) return selected;
  const professionState = app.results?.endState
    ?.profession as SchedulerRecord | undefined;
  const availableFlips = professionState?.availableFlips;
  if (!availableFlips || typeof availableFlips !== "object") return selected;
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

export function skillBarInspectionStacks(
  skills: readonly Skill[],
): SkillBarInspectionStack[] {
  const visibleSkillIds = new Set(skills.map((skill) => Number(skill.id)));
  const childrenByRoot = new Map<number, Skill[]>();
  const childSkillIds = new Set<number>();

  for (const skill of skills) {
    const rootId = Number(skill.chainRoot);
    if (
      !Number.isFinite(rootId) ||
      rootId === Number(skill.id) ||
      !visibleSkillIds.has(rootId)
    ) {
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
          Number(left.chainStep ?? Number.MAX_SAFE_INTEGER) -
          Number(right.chainStep ?? Number.MAX_SAFE_INTEGER),
      ),
    }));
}

function inspectionSkillSlotHtml(skill: Skill, child = false): string {
  return `<div class="skill-bar-inspection-slot${child ? " child-skill" : ""}">
      <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}">
          <img src="${esc(skill.icon || "")}" alt="">
      </div>
  </div>`;
}

function inspectionSkillStacksHtml(skills: readonly Skill[]): string {
  return skillBarInspectionStacks(skills)
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
                </div>`,
            )
            .join("")}
        </div>`,
    )
    .join("");
}

function multiSelectionInspectionGroupHtml(
  app: ProfessionAppState,
  group: ProfessionSkillBarGroup,
): string {
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
            skillId: skill.id,
          }));
      const selectedEntry = selection.optionEntries?.find(
        (entry) => String(entry.value) === String(selection.selectionValue),
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
            description: selectedEntry.description,
          }
        : selectedSkill;
      if (!display || !options.length) return "";
      const selectionSlot = `<div class="skill-bar-inspection-slot selectable"
          data-selection-key="${esc(selection.selectionKey)}"
          data-selection-index="${selection.selectionIndex}">
          <div class="sbar-icon" title="${esc(`${display.name}\n${gw2ApiText(display.description)}`)}">
              <img src="${esc(display.icon || "")}" alt="">
          </div>
          <div class="sbar-arrow">&#9660;</div>
          <div class="sbar-dropdown">${
            selection.filterPlaceholder
              ? `<input class="sbar-dropdown-filter" type="search" placeholder="${esc(selection.filterPlaceholder)}" aria-label="${esc(selection.filterPlaceholder)}" autocomplete="off" spellcheck="false">`
              : ""
          }${options
            .map(
              (option) =>
                `<div class="dd-item" data-selection-value="${esc(option.value)}"${
                  option.skillId == null
                    ? ""
                    : ` data-skill-id="${esc(option.skillId)}"`
                }>
                  <img src="${esc(option.icon || "")}" alt="">
                  <span>${esc(option.label)}</span>
              </div>`,
            )
            .join("")}${
            selection.filterPlaceholder
              ? '<div class="dd-empty sbar-dropdown-filter-empty" hidden>No matching options</div>'
              : ""
          }</div>
      </div>`;
      return leadingSkills.length || associatedSkills.length
        ? `<div class="skill-bar-inspection-selection">
            ${inspectionSkillStacksHtml(leadingSkills)}${selectionSlot}${inspectionSkillStacksHtml(associatedSkills)}
          </div>`
        : selectionSlot;
    })
    .join("");
  const skillSlots = group.skillIds
    .map((id) => app.skillById.get(Number(id)))
    .filter((skill): skill is Skill => skill != null);
  return `<div class="skill-bar-inspection-group${
    group.className ? ` ${esc(group.className)}` : ""
  }" style="--inspection-color:${esc(group.color || "var(--accent)")}">
      <span class="skill-bar-inspection-label">${esc(group.label)}</span>
      <div class="skill-bar-inspection-skills">${selectionSlots}${inspectionSkillStacksHtml(skillSlots)}</div>
  </div>`;
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function renderSkills(app: ProfessionAppState): void {
  const spec = app.adapter.eliteSpecialization(app.build);
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  const skillsForSet = ([mh, oh]: readonly string[]): Skill[] => {
    return [
      ...new Map(
        app.skills
          .filter((skill) => {
            if (skill.type !== "Weapon" || !skill.weapon) return false;
            if (
              !app.adapter.isSkillAvailable(skill, {
                build: app.build,
                specialization: spec,
              })
            )
              return false;
            return app.adapter.weaponSkillMatchesSet(skill, [mh, oh], {
              build: app.build,
              specialization: spec,
              catalog: app.profession.catalog,
              weaponData: app.weaponData,
              professionState: app.results?.endState?.profession,
              weaponBarPreview: true,
            });
          })
          .map((skill) => [skill.name, skill]),
      ).values(),
    ].sort((a, b) => {
      const slotOrder = String(a.slot).localeCompare(String(b.slot));
      if (slotOrder) return slotOrder;
      const sequenceOrder =
        Number(a.weaponBarChainStep ?? a.chainStep ?? Number.MAX_SAFE_INTEGER) -
        Number(b.weaponBarChainStep ?? b.chainStep ?? Number.MAX_SAFE_INTEGER);
      return sequenceOrder || 0;
    });
  };
  const set1Skills = skillsForSet(app.build.weapons);
  const set2Skills = skillsForSet(app.build.alternateWeapons);
  const weaponIcon = (skill: Skill, chained = false): string =>
    `<div class="wskill ${chained ? "chain-skill" : "main"}" title="${esc(skill.name)}\n${esc(gw2ApiText(skill.description))}">
            <img src="${esc(skill.icon)}" alt="">${skill.variantBadge ? `<span class="skill-variant-badge wskill-variant-badge">${esc(skill.variantBadge)}</span>` : ""}<span class="wslot-num">${esc(String(skill.slot).replace("Weapon_", ""))}</span>
        </div>`;
  const weaponSlots = (
    skills: readonly Skill[],
    flattenSameSlots = false,
  ): string => {
    return weaponBarSkillStacks(skills, flattenSameSlots)
      .map(
        (slotSkills) =>
          `<div class="weapon-slot">${slotSkills
            .map((skill, index) =>
              index === 0
                ? weaponIcon(skill)
                : `<div class="weapon-chain-step">
              <span class="weapon-chain-arrow" aria-hidden="true">↳</span>
              ${weaponIcon(skill, true)}
            </div>`,
            )
            .join("")}</div>`,
      )
      .join("");
  };
  const weaponSetPreview = (
    setNumber: number,
    skills: readonly Skill[],
  ): string => {
    const groups = groupWeaponSkillsByAttunement(skills, spec);
    if (groups.length === 1 && groups[0].attunement == null) {
      const label = hasSecondWeaponSet
        ? `<span class="weapon-set-preview-label">Set ${setNumber}</span>`
        : "";
      return `<div class="weapon-set-preview">${label}${weaponSlots(skills)}</div>`;
    }
    return `<div class="weapon-set-preview-group" data-weapon-set="${setNumber}">
        ${hasSecondWeaponSet ? `<span class="weapon-set-preview-group-label">Set ${setNumber}</span>` : ""}
        ${groups
          .map(
            ({ attunement, skills: attunementSkills }) =>
              `<div class="weapon-set-preview weapon-attunement-preview" data-attunement="${esc(String(attunement))}">
                <span class="weapon-set-preview-label">${esc(String(attunement))}</span>${weaponSlots(attunementSkills, attunement === "Dual")}
              </div>`,
          )
          .join("")}
      </div>`;
  };
  requiredElement("weapon-bar").innerHTML = `
            ${weaponSetPreview(1, set1Skills)}
            ${
              hasSecondWeaponSet && app.build.alternateWeapons[0]
                ? weaponSetPreview(2, set2Skills)
                : ""
            }`;

  if (app.adapter.slotLoadout) {
    renderFixedSlotLoadout(app, spec);
    return;
  }
  const slots: readonly (readonly [string, string])[] = [
    ["Heal", "Heal"],
    ["Utility1", "Utility"],
    ["Utility2", "Utility"],
    ["Utility3", "Utility"],
    ["Elite", "Elite"],
  ];
  const selectedSkillBarHtml = slots
    .map(([key, type]) => {
      const current = app.skillByName.get(app.build.selectedSkills[key]);
      const display = skillBarDisplaySkill(app, current);
      return `<div class="skill-bar-slot ${type === "Heal" ? "heal-border" : type === "Elite" ? "elite-border" : ""}" data-key="${key}">
                <div class="sbar-icon" title="${esc(display?.displayName || display?.name || "Choose skill")}"><img src="${esc(display?.icon || "")}" alt=""></div>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${availableSlotSkills(app, type)
                  .map(
                    (skill) =>
                      `<div class="dd-item" data-name="${esc(skill.name)}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.displayName || skill.name)}</span></div>`,
                  )
                  .join("")}</div>
            </div>`;
    })
    .join("");
  const inspectionGroups =
    app.profession.ui.skillBarGroups?.({
      build: app.build,
      specialization: spec,
      catalog: app.profession.catalog,
      professionState: app.results?.endState?.profession,
    }) || [];
  const skillBar = requiredElement("skill-bar");
  const inspectionLayout =
    inspectionGroups.find((group) => group.layout)?.layout || "";
  skillBar.classList.toggle("has-inspection", inspectionGroups.length > 0);
  skillBar.innerHTML = inspectionGroups.length
    ? `<div class="skill-bar-selected">${selectedSkillBarHtml}</div>
                <div class="skill-bar-inspection${
                  inspectionLayout ? ` ${esc(inspectionLayout)}` : ""
                }"${
                  inspectionLayout
                    ? ` data-layout="${esc(inspectionLayout)}"`
                    : ""
                }>${inspectionGroups
                  .map((group) => {
                    if (group.selections?.length) {
                      return multiSelectionInspectionGroupHtml(app, group);
                    }
                    const optionSkills = (group.optionSkillIds || [])
                      .map((id) => app.skillById.get(Number(id)))
                      .filter((skill) => skill != null);
                    const optionEntries = group.optionEntries?.length
                      ? group.optionEntries
                      : optionSkills.map((skill) => ({
                          value: String(skill.id),
                          label: skill.name,
                          icon: skill.icon,
                          description: skill.description,
                          skillId: skill.id,
                        }));
                    const selectedEntry = group.optionEntries?.find(
                      (entry) =>
                        String(entry.value) === String(group.selectionValue),
                    );
                    const displaySkills = group.skillIds
                      .map((id) => app.skillById.get(Number(id)))
                      .filter((skill): skill is Skill => skill != null);
                    const displayEntries = selectedEntry
                      ? [
                          {
                            name: selectedEntry.label,
                            icon: selectedEntry.icon,
                            description: selectedEntry.description,
                          },
                        ]
                      : displaySkills;
                    const selectable =
                      group.selectionKey &&
                      Number.isInteger(Number(group.selectionIndex)) &&
                      optionEntries.length > 0;
                    return `<div class="skill-bar-inspection-group${
                      group.className ? ` ${esc(group.className)}` : ""
                    }"
                        style="--inspection-color:${esc(group.color || "var(--accent)")}">
                        <span class="skill-bar-inspection-label">${esc(group.label)}</span>
                        <div class="skill-bar-inspection-skills">${
                          !selectable && !selectedEntry
                            ? inspectionSkillStacksHtml(displaySkills)
                            : displayEntries
                                .map(
                                  (
                                    skill,
                                  ) => `<div class="skill-bar-inspection-slot${
                                    selectable ? " selectable" : ""
                                  }"${
                                    selectable
                                      ? ` data-selection-key="${esc(group.selectionKey)}"
                                    data-selection-index="${Number(group.selectionIndex)}"`
                                      : ""
                                  }>
                                <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}">
                                    <img src="${esc(skill.icon || "")}" alt="">
                                </div>
                                ${
                                  selectable
                                    ? `<div class="sbar-arrow">▼</div>
                                    <div class="sbar-dropdown">${optionEntries
                                      .map(
                                        (option) =>
                                          `<div class="dd-item" data-selection-value="${esc(option.value)}"${
                                            option.skillId == null
                                              ? ""
                                              : ` data-skill-id="${esc(option.skillId)}"`
                                          }>
                                            <img src="${esc(option.icon || "")}" alt="">
                                            <span>${esc(option.label)}</span>
                                        </div>`,
                                      )
                                      .join("")}</div>`
                                    : ""
                                }
                            </div>`,
                                )
                                .join("")
                        }
                        </div>
                    </div>`;
                  })
                  .join("")}</div>`
    : selectedSkillBarHtml;
  skillBar.querySelectorAll(".skill-bar-slot").forEach((slot) => {
    if (!(slot instanceof HTMLElement)) return;
    const icon = slot.querySelector(".sbar-icon");
    const dropdown = slot.querySelector(".sbar-dropdown");
    if (!icon || !dropdown) return;
    icon.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".sbar-dropdown.open").forEach((drop) => {
        if (drop !== dropdown) drop.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });
    slot.querySelectorAll(".dd-item").forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.addEventListener("click", () => {
        const key = slot.dataset.key;
        const name = item.dataset.name;
        if (!key || !name) return;
        app.build.selectedSkills[key] = name;
        app.changed();
      });
    });
  });
  skillBar
    .querySelectorAll(".skill-bar-inspection-slot[data-selection-key]")
    .forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      const icon = slot.querySelector(".sbar-icon");
      const dropdown = slot.querySelector(".sbar-dropdown");
      if (!icon || !dropdown) return;
      const filterInput = dropdown.querySelector(".sbar-dropdown-filter");
      const filterEmpty = dropdown.querySelector(".sbar-dropdown-filter-empty");
      const filterOptions = () => {
        if (!(filterInput instanceof HTMLInputElement)) return;
        const query = filterInput.value.trim().toLocaleLowerCase();
        let visibleOptions = 0;
        dropdown.querySelectorAll<HTMLElement>(".dd-item").forEach((item) => {
          const label = item.querySelector("span")?.textContent || "";
          const visible = label.toLocaleLowerCase().includes(query);
          item.hidden = !visible;
          if (visible) visibleOptions += 1;
        });
        if (filterEmpty instanceof HTMLElement) {
          filterEmpty.hidden = visibleOptions > 0;
        }
      };
      if (filterInput instanceof HTMLInputElement) {
        filterInput.addEventListener("input", filterOptions);
        filterInput.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          dropdown.classList.remove("open");
          filterInput.blur();
        });
      }
      icon.addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".sbar-dropdown.open").forEach((drop) => {
          if (drop !== dropdown) {
            drop.classList.remove("open");
          }
        });
        const opening = !dropdown.classList.contains("open");
        dropdown.classList.toggle("open", opening);
        if (opening && filterInput instanceof HTMLInputElement) {
          filterInput.value = "";
          filterOptions();
          filterInput.focus();
        }
      });
      slot.querySelectorAll(".dd-item").forEach((item) => {
        if (!(item instanceof HTMLElement)) return;
        item.addEventListener("click", (event) => {
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
                catalog: app.profession.catalog,
              },
              {
                key,
                index,
                ...(rawSkillId == null ? {} : { skillId }),
                ...(value == null ? {} : { value }),
              },
            );
          } else if (rawSkillId != null) {
            const values = Array.isArray(app.build[key])
              ? [...app.build[key]]
              : [];
            values[index] = skillId;
            app.build[key] = values;
          }
          app.changed();
        });
      });
    });
}

/**
 * @param {ProfessionAppState} app
 * @param {string} spec
 * @returns {void}
 */
function renderFixedSlotLoadout(app: ProfessionAppState, spec: string): void {
  const loadout = app.adapter.slotLoadout;
  if (!loadout) return;
  const context = {
    build: app.build,
    specialization: spec,
    professionState: app.results?.endState?.profession,
    catalog: app.profession.catalog,
  };
  const view = loadout.view(context);
  const skillBar = requiredElement("skill-bar");
  const slotHtml = (skill: Skill, child = false): string =>
    `<div class="skill-bar-slot${child ? " child-skill" : ""}">
        <div class="sbar-icon" title="${esc(skill.name)}"><img src="${esc(skill.icon || "")}" alt=""></div>
    </div>`;
  const barSkillHtml = (skill: Skill): string => {
    const childIds =
      typeof loadout.skillChildren === "function"
        ? loadout.skillChildren(context, skill.id)
        : [];
    const children = childIds
      .map((id) => app.skillById.get(Number(id)))
      .filter((child): child is Skill => child != null);
    return `<div class="fixed-loadout-skill-stack">
        ${slotHtml(skill)}
        ${children
          .map(
            (child) =>
              `<div class="fixed-loadout-chain-step">
                <span class="weapon-chain-arrow" aria-hidden="true">&#8627;</span>
                ${slotHtml(child, true)}
              </div>`,
          )
          .join("")}
      </div>`;
  };
  const barHtml = (bar: ProfessionSlotLoadoutBar): string =>
    `<div class="fixed-loadout-bar${
      view.formatActiveBar ? (bar.active ? " active" : " inactive") : " static"
    }">
            <span class="fixed-loadout-bar-label">${esc(bar.label)}</span>
            ${bar.skillIds
              .map((id) => app.skillById.get(Number(id)))
              .filter((skill) => skill != null)
              .map(barSkillHtml)
              .join("")}
        </div>`;
  const selectorHtml = (selector: ProfessionSlotLoadoutSelector): string =>
    view.selectionControl === "icons"
      ? `<div class="fixed-loadout-icon-selector">
                <span>${esc(selector.label)}</span>
                <div class="fixed-loadout-icon-options">${selector.options
                  .map(
                    (entry) =>
                      `<button type="button" class="fixed-loadout-icon${
                        entry.value === selector.value ? " selected" : ""
                      }" data-loadout-key="${esc(selector.key)}"
                        data-loadout-value="${esc(entry.value)}"
                        title="${esc(entry.label)}"${entry.disabled ? " disabled" : ""}>
                        <img src="${esc(entry.icon || "")}" alt="">
                    </button>`,
                  )
                  .join("")}</div>
            </div>`
      : `<label><span>${esc(selector.label)}</span>
                <select class="gear-select" data-loadout-key="${esc(selector.key)}">
                    ${selector.options
                      .map(
                        (entry) =>
                          `<option value="${esc(entry.value)}"${entry.value === selector.value ? " selected" : ""}${entry.disabled ? " disabled" : ""}>${esc(entry.label)}</option>`,
                      )
                      .join("")}
                </select>
            </label>`;
  const pairedIconLoadout =
    view.selectionControl === "icons" &&
    view.selectors.length === view.bars.length;
  skillBar.innerHTML = pairedIconLoadout
    ? `<div class="fixed-loadout-pairs">${view.selectors
        .map(
          (selector, index) =>
            `<div class="fixed-loadout-pair">
              ${selectorHtml(selector)}
              ${barHtml(view.bars[index])}
          </div>`,
        )
        .join("")}</div>`
    : `<div class="fixed-loadout-selectors">
          ${view.selectors.map(selectorHtml).join("")}
      </div>${view.bars.map(barHtml).join("")}`;
  skillBar.querySelectorAll("select[data-loadout-key]").forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener("change", () => {
      const key = select.dataset.loadoutKey;
      if (!key) return;
      loadout.updateBuild(app.build, key, select.value, context);
      app.changed();
    });
  });
  skillBar.querySelectorAll("button[data-loadout-key]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      const key = button.dataset.loadoutKey;
      const value = button.dataset.loadoutValue;
      if (!key || value === undefined) return;
      loadout.updateBuild(app.build, key, value, context);
      app.changed();
    });
  });
}
