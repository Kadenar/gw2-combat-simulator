import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";
import { isSlotSkillSelectable } from "./selection.js";

function availableSlotSkills(app, type) {
  const spec = app.adapter.eliteSpecialization(app.build);
  return [
    ...new Map(
      app.skills
        .filter(
          (skill) =>
            skill.implemented !== false &&
            skill.type === type &&
            isSlotSkillSelectable(app, skill, spec) &&
            (!skill.specialization || skill.specialization === spec) &&
            app.adapter.isSkillAvailable(skill, {
              build: app.build,
              specialization: spec,
            }),
        )
        .map((skill) => [skill.name, skill]),
    ).values(),
  ];
}

export function renderSkills(app) {
  const spec = app.adapter.eliteSpecialization(app.build);
  const skillsForSet = ([mh, oh]) => {
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
            });
          })
          .map((skill) => [skill.name, skill]),
      ).values(),
    ].sort((a, b) => a.slot.localeCompare(b.slot));
  };
  const set1Skills = skillsForSet(app.build.weapons);
  const set2Skills = skillsForSet(app.build.alternateWeapons);
  const weaponIcon = (
    skill,
  ) => `<div class="wskill" title="${esc(skill.name)}\n${esc(gw2ApiText(skill.description))}">
            <img src="${esc(skill.icon)}" alt=""><span class="wslot-num">${esc(skill.slot.replace("Weapon_", ""))}</span>
        </div>`;
  document.getElementById("weapon-bar").innerHTML = `
            <div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 1</span>${set1Skills.map(weaponIcon).join("")}</div>
            ${
              app.build.alternateWeapons[0]
                ? `<div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 2</span>${set2Skills.map(weaponIcon).join("")}</div>`
                : ""
            }`;

  if (app.adapter.slotLoadout) {
    renderFixedSlotLoadout(app, spec, set1Skills, set2Skills);
    return;
  }
  const slots = [
    ["Heal", "Heal"],
    ["Utility1", "Utility"],
    ["Utility2", "Utility"],
    ["Utility3", "Utility"],
    ["Elite", "Elite"],
  ];
  const selectedSkillBarHtml = slots
    .map(([key, type]) => {
      const current = app.skillByName.get(app.build.selectedSkills[key]);
      return `<div class="skill-bar-slot ${type === "Heal" ? "heal-border" : type === "Elite" ? "elite-border" : ""}" data-key="${key}">
                <div class="sbar-icon" title="${esc(current?.name || "Choose skill")}"><img src="${esc(current?.icon || "")}" alt=""></div>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${availableSlotSkills(app, type)
                  .map(
                    (skill) =>
                      `<div class="dd-item" data-name="${esc(skill.name)}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.name)}</span></div>`,
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
  const inspectionSkills = inspectionGroups.flatMap((group) =>
    group.skillIds.map((id) => app.skillById.get(Number(id))).filter(Boolean),
  );
  const skillBar = document.getElementById("skill-bar");
  skillBar.classList.toggle("has-inspection", inspectionGroups.length > 0);
  skillBar.innerHTML = inspectionGroups.length
    ? `<div class="skill-bar-selected">${selectedSkillBarHtml}</div>
                <div class="skill-bar-inspection">${inspectionGroups
                  .map((group) => {
                    const optionSkills = (group.optionSkillIds || [])
                      .map((id) => app.skillById.get(Number(id)))
                      .filter(Boolean);
                    const selectable =
                      group.selectionKey &&
                      Number.isInteger(Number(group.selectionIndex)) &&
                      optionSkills.length > 0;
                    return `<div class="skill-bar-inspection-group"
                        style="--inspection-color:${esc(group.color || "var(--accent)")}">
                        <span class="skill-bar-inspection-label">${esc(group.label)}</span>
                        <div class="skill-bar-inspection-skills">${group.skillIds
                          .map((id) => app.skillById.get(Number(id)))
                          .filter(Boolean)
                          .map(
                            (skill) => `<div class="skill-bar-inspection-slot${
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
                                    <div class="sbar-dropdown">${optionSkills
                                      .map(
                                        (optionSkill) =>
                                          `<div class="dd-item" data-skill-id="${optionSkill.id}">
                                            <img src="${esc(optionSkill.icon || "")}" alt="">
                                            <span>${esc(optionSkill.name)}</span>
                                        </div>`,
                                      )
                                      .join("")}</div>`
                                    : ""
                                }
                            </div>`,
                          )
                          .join("")}
                        </div>
                    </div>`;
                  })
                  .join("")}</div>`
    : selectedSkillBarHtml;
  skillBar.querySelectorAll(".skill-bar-slot").forEach((slot) => {
    slot.querySelector(".sbar-icon").addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".sbar-dropdown.open").forEach((drop) => {
        if (drop !== slot.querySelector(".sbar-dropdown"))
          drop.classList.remove("open");
      });
      slot.querySelector(".sbar-dropdown").classList.toggle("open");
    });
    slot.querySelectorAll(".dd-item").forEach((item) => {
      item.addEventListener("click", () => {
        app.build.selectedSkills[slot.dataset.key] = item.dataset.name;
        app.changed();
      });
    });
  });
  skillBar
    .querySelectorAll(".skill-bar-inspection-slot[data-selection-key]")
    .forEach((slot) => {
      slot.querySelector(".sbar-icon").addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".sbar-dropdown.open").forEach((drop) => {
          if (drop !== slot.querySelector(".sbar-dropdown")) {
            drop.classList.remove("open");
          }
        });
        slot.querySelector(".sbar-dropdown").classList.toggle("open");
      });
      slot.querySelectorAll(".dd-item").forEach((item) => {
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          const key = slot.dataset.selectionKey;
          const index = Number(slot.dataset.selectionIndex);
          const skillId = Number(item.dataset.skillId);
          if (app.profession.ui.updateSkillBarSelection) {
            app.profession.ui.updateSkillBarSelection(
              {
                build: app.build,
                specialization: spec,
                professionState: app.results?.endState?.profession,
                catalog: app.profession.catalog,
              },
              { key, index, skillId },
            );
          } else {
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

  const rows = [
    ...new Map(
      [
        ...set1Skills,
        ...set2Skills,
        ...slots
          .map(([key]) => app.skillByName.get(app.build.selectedSkills[key]))
          .filter(Boolean),
        ...inspectionSkills,
      ].map((skill) => [skill.name, skill]),
    ).values(),
  ];
  document.getElementById("skill-info-table").innerHTML =
    `<div class="skill-info-grid">
            <div class="skill-info-header" role="row">
                <span role="columnheader">Skill</span>
                <span role="columnheader">Cast Time</span>
                <span role="columnheader">Base Cooldown</span>
            </div>
            ${rows
              .map(
                (skill) =>
                  `<div class="skill-info-row" role="row">
                <span class="skill-info-skill" role="cell">
                    <img src="${esc(skill.icon || "")}" alt=""><span class="skill-info-name">${esc(skill.name)}</span>
                </span>
                <span class="skill-info-value" role="cell">${(Number(skill.castTimeMs || 0) / 1000).toFixed(2)}s</span>
                <span class="skill-info-value" role="cell">${Number(skill.cooldown || 0)}s CD</span>
            </div>`,
              )
              .join("")}</div>`;
}

function renderFixedSlotLoadout(app, spec, set1Skills, set2Skills) {
  const context = {
    build: app.build,
    specialization: spec,
    professionState: app.results?.endState?.profession,
    catalog: app.profession.catalog,
  };
  const view = app.adapter.slotLoadout.view(context);
  const skillBar = document.getElementById("skill-bar");
  const barHtml = (bar) => `<div class="fixed-loadout-bar${
    view.formatActiveBar ? (bar.active ? " active" : " inactive") : " static"
  }">
            <span class="skill-bar-label">${esc(bar.label)}</span>
            ${bar.skillIds
              .map((id) => app.skillById.get(Number(id)))
              .filter(Boolean)
              .map(
                (skill) =>
                  `<div class="skill-bar-slot"><div class="sbar-icon" title="${esc(skill.name)}"><img src="${esc(skill.icon || "")}" alt=""></div></div>`,
              )
              .join("")}
        </div>`;
  const selectorHtml = (selector) =>
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
  skillBar.innerHTML = `<div class="fixed-loadout-selectors">
            ${view.selectors.map(selectorHtml).join("")}
        </div>${view.bars.map(barHtml).join("")}`;
  skillBar.querySelectorAll("select[data-loadout-key]").forEach((select) => {
    select.addEventListener("change", () => {
      app.adapter.slotLoadout.updateBuild(
        app.build,
        select.dataset.loadoutKey,
        select.value,
        context,
      );
      app.changed();
    });
  });
  skillBar.querySelectorAll("button[data-loadout-key]").forEach((button) => {
    button.addEventListener("click", () => {
      app.adapter.slotLoadout.updateBuild(
        app.build,
        button.dataset.loadoutKey,
        button.dataset.loadoutValue,
        context,
      );
      app.changed();
    });
  });

  const rows = [
    ...new Map(
      [
        ...set1Skills,
        ...set2Skills,
        ...view.bars.flatMap((bar) =>
          bar.skillIds
            .map((id) => app.skillById.get(Number(id)))
            .filter(Boolean),
        ),
      ].map((skill) => [skill.id, skill]),
    ).values(),
  ];
  document.getElementById("skill-info-table").innerHTML =
    `<div class="skill-info-grid">
            <div class="skill-info-header" role="row">
                <span role="columnheader">Skill</span>
                <span role="columnheader">Cast Time</span>
                <span role="columnheader">Base Cooldown</span>
            </div>
            ${rows
              .map(
                (skill) => `<div class="skill-info-row" role="row">
                <span class="skill-info-skill" role="cell">
                    <img src="${esc(skill.icon || "")}" alt=""><span class="skill-info-name">${esc(skill.name)}</span>
                </span>
                <span class="skill-info-value" role="cell">${(Number(skill.castTimeMs || 0) / 1000).toFixed(2)}s</span>
                <span class="skill-info-value" role="cell">${Number(skill.cooldown || 0)}s CD</span>
            </div>`,
              )
              .join("")}
        </div>`;
}
