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

export function weaponSetLabelVisible(
  professionId: string,
  hasSecondWeaponSet: boolean,
): boolean {
  return hasSecondWeaponSet || professionId === "engineer";
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
  const professionState = app.results?.endState?.profession as
    SchedulerRecord | undefined;
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
      const labeled = Boolean(selection.keyLabel || selection.typeLabel);
      const selectionSlot = `<div class="skill-bar-inspection-slot selectable${labeled ? " labeled-skill-bar-slot" : ""}"
          data-selection-key="${esc(selection.selectionKey)}"
          data-selection-index="${selection.selectionIndex}">
          <div class="sbar-icon" title="${esc(`${display.name}\n${gw2ApiText(display.description)}`)}">
              <img src="${esc(display.icon || "")}" alt="">
              ${labeled ? '<span class="sbar-icon-arrow" aria-hidden="true">&#9660;</span>' : ""}
          </div>
          ${selection.keyLabel ? `<span class="skill-bar-key">${esc(selection.keyLabel)}</span>` : ""}
          ${selection.typeLabel ? `<span class="skill-bar-type">${esc(selection.typeLabel)}</span>` : ""}
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
  const skillBarGroups =
    app.profession.ui.skillBarGroups?.({
      build: app.build,
      specialization: spec,
      catalog: app.profession.catalog,
      professionState: app.results?.endState?.profession,
    }) || [];
  const weaponBarGroups = skillBarGroups.filter(
    (group) => group.placement === "weapon-bar",
  );
  const inspectionGroups = skillBarGroups.filter(
    (group) => group.placement !== "weapon-bar",
  );
  const separateWeaponChains = document.body.classList.contains(
    "profession-loadout-theme",
  );
  const weaponIcon = (
    skill: Skill,
    chained = false,
    displaySlot?: string | number,
  ): string =>
    `<div class="weapon-skill-frame${chained ? " chain-skill-frame" : ""}">
      <div class="wskill ${chained ? "chain-skill" : "main"}" title="${esc(skill.name)}\n${esc(gw2ApiText(skill.description))}">
        <img src="${esc(skill.icon)}" alt="">${skill.variantBadge ? `<span class="skill-variant-badge wskill-variant-badge">${esc(skill.variantBadge)}</span>` : ""}
      </div>
      <span class="wslot-num">${esc(String(displaySlot ?? skill.slot).replace("Weapon_", ""))}</span>
    </div>`;
  const weaponStacks = (
    stacks: readonly (readonly Skill[])[],
    separateChains = false,
    sequentialSlots = false,
  ): string => {
    if (separateChains) {
      return `<div class="weapon-primary-skills">${stacks
        .map((slotSkills, index) => {
          const followupSkills = slotSkills.slice(1);
          return `<div class="weapon-slot${followupSkills.length ? " has-followups" : ""}">
              ${weaponIcon(slotSkills[0], false, sequentialSlots ? index + 1 : undefined)}
              ${
                followupSkills.length
                  ? `<div class="weapon-followups">
                      ${followupSkills
                        .map(
                          (skill) =>
                            `<div class="weapon-chain-step">
                              <span class="weapon-chain-arrow" aria-hidden="true">↓</span>
                              ${weaponIcon(skill, true)}
                            </div>`,
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </div>`;
        })
        .join("")}</div>`;
    }
    return stacks
      .map(
        (slotSkills, slotIndex) =>
          `<div class="weapon-slot">${slotSkills
            .map((skill, index) =>
              index === 0
                ? weaponIcon(
                    skill,
                    false,
                    sequentialSlots ? slotIndex + 1 : undefined,
                  )
                : `<div class="weapon-chain-step">
              <span class="weapon-chain-arrow" aria-hidden="true">↳</span>
              ${weaponIcon(skill, true)}
            </div>`,
            )
            .join("")}</div>`,
      )
      .join("");
  };
  const weaponSlots = (
    skills: readonly Skill[],
    flattenSameSlots = false,
    separateChains = false,
  ): string =>
    weaponStacks(
      weaponBarSkillStacks(skills, flattenSameSlots),
      separateChains,
    );
  const weaponSetPreview = (
    setNumber: number,
    skills: readonly Skill[],
    weapons: readonly string[],
  ): string => {
    const groups = groupWeaponSkillsByAttunement(skills, spec);
    const weaponNames = weapons.filter(Boolean).join(" / ");
    const setLabel = `<span class="weapon-set-number">Set ${setNumber}</span><span class="weapon-set-name">${esc(weaponNames)}</span>`;
    const showSetLabel = weaponSetLabelVisible(
      app.profession.id,
      hasSecondWeaponSet,
    );
    if (groups.length === 1 && groups[0].attunement == null) {
      const label = showSetLabel
        ? `<span class="weapon-set-preview-label">${setLabel}</span>`
        : "";
      return `<div class="weapon-set-preview">${label}${weaponSlots(skills, false, separateWeaponChains)}</div>`;
    }
    return `<div class="weapon-set-preview-group" data-weapon-set="${setNumber}">
        ${showSetLabel ? `<span class="weapon-set-preview-group-label">${setLabel}</span>` : ""}
        ${groups
          .map(({ attunement, skills: attunementSkills }) => {
            const attunementSkill = app.skillByName.get(
              `${String(attunement)} Attunement`,
            );
            return `<div class="weapon-set-preview weapon-attunement-preview" data-attunement="${esc(String(attunement))}">
                <span class="weapon-set-preview-label">${
                  attunementSkill?.icon
                    ? `<img src="${esc(attunementSkill.icon)}" alt="">`
                    : ""
                }<span>${esc(String(attunement))}</span></span>${weaponSlots(attunementSkills, attunement === "Dual", true)}
              </div>`;
          })
          .join("")}
      </div>`;
  };
  const mechanicWeaponPreview = (group: ProfessionSkillBarGroup): string => {
    const skills = group.skillIds
      .map((id) => app.skillById.get(Number(id)))
      .filter((skill): skill is Skill => skill != null);
    if (!skills.length) return "";
    const stacks = skillBarInspectionStacks(skills).map(
      ({ root, children }) => [root, ...children],
    );
    return `<div class="weapon-set-preview profession-weapon-set-preview${
      group.className ? ` ${esc(group.className)}` : ""
    }" data-weapon-bar-group="${esc(group.id)}">
        <span class="weapon-set-preview-label"><span class="weapon-set-number">${esc(group.label)}</span></span>
        ${weaponStacks(stacks, false, true)}
      </div>`;
  };
  requiredElement("weapon-bar").innerHTML = `
            ${weaponSetPreview(1, set1Skills, app.build.weapons)}
            ${
              hasSecondWeaponSet && app.build.alternateWeapons[0]
                ? weaponSetPreview(2, set2Skills, app.build.alternateWeapons)
                : ""
            }
            ${weaponBarGroups.map(mechanicWeaponPreview).join("")}`;

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
    .map(([key, type], index) => {
      const current = app.skillByName.get(app.build.selectedSkills[key]);
      const display = skillBarDisplaySkill(app, current);
      return `<div class="skill-bar-slot ${type === "Heal" ? "heal-border" : type === "Elite" ? "elite-border" : ""}" data-key="${key}">
                <div class="sbar-icon" title="${esc(display?.displayName || display?.name || "Choose skill")}"><img src="${esc(display?.icon || "")}" alt=""><span class="sbar-icon-arrow" aria-hidden="true">▼</span></div>
                <span class="skill-bar-key">${index + 1}</span>
                <span class="skill-bar-type">${esc(type)}</span>
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
    const toggleDropdown = (event: Event) => {
      event.stopPropagation();
      document.querySelectorAll(".sbar-dropdown.open").forEach((drop) => {
        if (drop !== dropdown) drop.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    };
    icon.addEventListener("click", toggleDropdown);
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
  const slotTypes = ["Heal", "Utility", "Utility", "Utility", "Elite"];
  const slotHtml = (skill: Skill, index: number, child = false): string => {
    const type = slotTypes[index] || "Skill";
    return `<div class="skill-bar-slot fixed-loadout-skill${
      child ? " child-skill" : ""
    }${!child && type === "Heal" ? " heal-border" : ""}${
      !child && type === "Elite" ? " elite-border" : ""
    }">
        <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}"><img src="${esc(skill.icon || "")}" alt=""></div>
        ${
          child
            ? ""
            : `<span class="skill-bar-key">${index + 1}</span>
               <span class="skill-bar-type">${esc(type)}</span>`
        }
    </div>`;
  };
  const barSkillHtml = (skill: Skill, index: number): string => {
    const childIds =
      typeof loadout.skillChildren === "function"
        ? loadout.skillChildren(context, skill.id)
        : [];
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
              </div>`,
          )
          .join("")}
      </div>`;
  };
  const barHtml = (bar: ProfessionSlotLoadoutBar): string =>
    `<div class="fixed-loadout-bar skill-bar-selected${
      view.formatActiveBar ? (bar.active ? " active" : " inactive") : " static"
    }">
        ${bar.skillIds
          .map((id) => app.skillById.get(Number(id)))
          .filter((skill): skill is Skill => skill != null)
          .map(barSkillHtml)
          .join("")}
      </div>`;
  const selectorHtml = (
    selector: ProfessionSlotLoadoutSelector,
    index: number,
  ): string => {
    if (view.selectionControl === "icons") {
      const selected = selector.options.find(
        (entry) => entry.value === selector.value,
      );
      return `<div class="skill-bar-slot fixed-loadout-icon-selector">
          <span class="fixed-loadout-selector-label">${esc(selector.label)}</span>
          <button type="button" class="fixed-loadout-trigger"
            data-loadout-toggle aria-expanded="false"
            aria-haspopup="listbox" aria-controls="fixed-loadout-menu-${index}">
            <img src="${esc(selected?.icon || "")}" alt="">
            <span class="fixed-loadout-trigger-copy">
              <strong>${esc(selected?.label || "Choose loadout")}</strong>
              <small>Change ${esc(selector.label.toLowerCase())}</small>
            </span>
            <span class="fixed-loadout-trigger-arrow" aria-hidden="true">&#9660;</span>
          </button>
          <div id="fixed-loadout-menu-${index}" class="sbar-dropdown fixed-loadout-dropdown" role="listbox">
            ${selector.options
              .map(
                (entry) =>
                  `<button type="button" class="dd-item fixed-loadout-option${
                    entry.value === selector.value ? " selected" : ""
                  }" data-loadout-key="${esc(selector.key)}"
                    data-loadout-value="${esc(entry.value)}" role="option"
                    aria-selected="${entry.value === selector.value}"${
                      entry.disabled ? " disabled" : ""
                    }>
                    <img src="${esc(entry.icon || "")}" alt="">
                    <span>${esc(entry.label)}</span>
                </button>`,
              )
              .join("")}
          </div>
        </div>`;
    }
    return `<label><span>${esc(selector.label)}</span>
                <select class="gear-select" data-loadout-key="${esc(selector.key)}">
                    ${selector.options
                      .map(
                        (entry) =>
                          `<option value="${esc(entry.value)}"${entry.value === selector.value ? " selected" : ""}${entry.disabled ? " disabled" : ""}>${esc(entry.label)}</option>`,
                      )
                      .join("")}
                </select>
            </label>`;
  };
  const pairedIconLoadout =
    view.selectionControl === "icons" &&
    view.selectors.length === view.bars.length;
  skillBar.innerHTML = pairedIconLoadout
    ? `<div class="fixed-loadout-pairs">${view.selectors
        .map(
          (selector, index) =>
            `<div class="fixed-loadout-pair">
              ${selectorHtml(selector, index)}
              ${barHtml(view.bars[index])}
          </div>`,
        )
        .join("")}</div>`
    : `<div class="fixed-loadout-selectors">
          ${view.selectors.map(selectorHtml).join("")}
      </div>${view.bars.map(barHtml).join("")}`;
  skillBar.querySelectorAll("button[data-loadout-toggle]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const dropdown = button.parentElement?.querySelector(
      ".fixed-loadout-dropdown",
    );
    if (!(dropdown instanceof HTMLElement)) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = !dropdown.classList.contains("open");
      document
        .querySelectorAll<HTMLElement>(".fixed-loadout-dropdown.open")
        .forEach((other) => {
          if (other === dropdown) return;
          other.classList.remove("open");
          other.parentElement
            ?.querySelector("button[data-loadout-toggle]")
            ?.setAttribute("aria-expanded", "false");
        });
      dropdown.classList.toggle("open", opening);
      button.setAttribute("aria-expanded", String(opening));
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      dropdown.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    });
  });
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
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = button.dataset.loadoutKey;
      const value = button.dataset.loadoutValue;
      if (!key || value === undefined) return;
      loadout.updateBuild(app.build, key, value, context);
      app.changed();
    });
  });
}
