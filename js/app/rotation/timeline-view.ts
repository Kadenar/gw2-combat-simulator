import {
  bindTimelineInteractions,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineSkillTooltip,
  timelineSkillCastOrdinals,
  updateRotationEntry,
} from "../../platform/ui/timeline.js";
import { escapeHtml as esc } from "../../platform/ui/html.js";
import { activeSpecialization, professionEndState } from "./context.js";
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON,
  resolveProcIcon,
} from "./icons.js";
import { resolvePaletteDropItem } from "./palette-view.js";
import { formatResultTimelineTime } from "./result-model.js";
import {
  continuumEndTimelineMarkers,
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterKey,
  procFilterLabel,
  procStackLabel,
  shatterResourceSpends,
  targetHealthTimelineMarkers,
  timelineWeaponRows,
} from "./timeline-model.js";
import type {
  LegacyRotationItem,
  SchedulerRecord,
  SchedulerStep,
} from "../../platform/engine/types.js";
import type { Gw2ProcStep } from "../../platform/gw2/types.js";
import type { TimelineInteractionOptions } from "../../platform/ui/types.js";
import type { ProfessionAppState } from "../profession/types.js";

type TimelineItem = SchedulerRecord & {
  name: string;
  skillId?: unknown;
  offset?: unknown;
  interruptMs?: unknown;
  waitMs?: unknown;
};

function timelineItem(
  entry: LegacyRotationItem | SchedulerRecord,
): TimelineItem {
  if (entry && typeof entry === "object") {
    return entry as TimelineItem;
  }
  return { name: String(entry || "") };
}

function syncProcVisibility(
  app: ProfessionAppState,
  procSteps: readonly Gw2ProcStep[],
): Set<string> {
  const procKeys = new Set(procSteps.map(procFilterKey));
  const current = app.procVisibility instanceof Set ? app.procVisibility : null;
  const knownKeys =
    app.procVisibilityKeys instanceof Set ? app.procVisibilityKeys : null;
  app.procVisibility = new Set(
    [...procKeys].filter(
      (key) => !knownKeys || !knownKeys.has(key) || current?.has(key),
    ),
  );
  app.procVisibilityKeys = procKeys;
  if (!current) {
    app.procVisibility = procKeys;
  }
  return app.procVisibility as Set<string>;
}

function editRotationOption(
  app: ProfessionAppState,
  index: number,
  key: string,
  label: string,
): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const raw = prompt(label, String(item?.[key] ?? ""));
  if (raw == null || Number(raw) < 1) return false;
  app.build.rotation[index] = updateRotationEntry(entry, {
    [key]: Math.round(Number(raw)),
  }) as LegacyRotationItem;
  return true;
}

function timelineInteractionOptions(
  app: ProfessionAppState,
): TimelineInteractionOptions {
  return {
    rotation: app.build.rotation,
    getDragState: () => app.dragState,
    setDragState: (value) => {
      app.dragState = value;
    },
    resolvePaletteEntry: (name, drag) => {
      const parsedSkillId = Number(drag?.skillId);
      return resolvePaletteDropItem(
        app,
        name,
        Number.isFinite(parsedSkillId) ? parsedSkillId : null,
      );
    },
    onChanged: () => app.changed(false),
    onRemove: (index) => app.build.rotation.splice(index, 1),
    onTruncate: (index) => app.build.rotation.splice(index),
    onEditOffset: (index) =>
      editRotationOption(
        app,
        index,
        "offset",
        "Offset (ms) from the start of the preceding cast:",
      ),
    onEditInterrupt: (index) =>
      editRotationOption(app, index, "interruptMs", "Interrupt time (ms):"),
    onEditWait: (index) =>
      editRotationOption(app, index, "waitMs", "Wait duration (ms):"),
  };
}

export function renderTimeline(app: ProfessionAppState): void {
  const element = document.getElementById("rotation-timeline");
  const procElement = document.getElementById("rotation-procs");
  if (!element) return;
  const procPanel =
    procElement?.querySelector<HTMLDetailsElement>(".rotation-procs-wrap") ||
    null;
  const procPanelWasOpen = procPanel?.open ?? false;
  element.ondragover = null;
  element.ondragleave = null;
  element.ondrop = null;
  if (!app.build.rotation.length) {
    element.classList.add("is-empty");
    element.innerHTML = `<div class="rot-empty">
            <strong>Build your rotation</strong>
            <span>Click or drag skills from the palette above</span>
        </div>`;
    if (procElement) procElement.innerHTML = "";
    bindTimelineInteractions(element, timelineInteractionOptions(app));
    return;
  }
  element.classList.remove("is-empty");
  const resultSteps = app.results?.steps || [];
  const steps = new Map<number, SchedulerStep>(
    resultSteps.filter((step) => step.ri >= 0).map((step) => [step.ri, step]),
  );
  const castOrdinals = timelineSkillCastOrdinals(resultSteps);
  const resourceSpends = shatterResourceSpends(app.results);
  const rows = timelineWeaponRows(app.build.rotation, {
    startingWeaponSet: app.build.startingWeaponSet,
    weaponSwapChangesSet:
      app.profession.ui.weaponSwapChangesSet !== false &&
      Boolean(app.build.alternateWeapons?.[0]),
    weaponLineTransition: (entry, current) => {
      const item = timelineItem(entry);
      const explicitSkillId =
        item.skillId == null ? null : Number(item.skillId);
      const skill =
        explicitSkillId !== null && Number.isFinite(explicitSkillId)
          ? app.skillById.get(explicitSkillId)
          : app.skillByName.get(String(item.name));
      return app.profession.ui.timelineWeaponLineTransition({
        entry: item,
        skill,
        build: app.build,
        ...current,
      });
    },
  });
  const formatTime = (timeMs: number): string =>
    formatResultTimelineTime(timeMs, app.results);

  const continuumEnds = continuumEndTimelineMarkers(
    app.results,
    app.build.rotation.length,
  );
  const continuumEndsByIndex = new Map<number, typeof continuumEnds>();
  for (const marker of continuumEnds) {
    const markers = continuumEndsByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    continuumEndsByIndex.set(marker.insertionIndex, markers);
  }
  const targetThresholds =
    app.profession.ui.targetHealthThresholds?.({
      specialization: activeSpecialization(app),
      build: app.build,
      professionState: professionEndState(app.results),
    }) || [];
  const healthMarkers = targetHealthTimelineMarkers(
    app.results,
    app.build.targetHealth,
    targetThresholds,
    app.build.rotation.length,
  );
  const healthMarkersByIndex = new Map<number, typeof healthMarkers>();
  for (const marker of healthMarkers) {
    const markers = healthMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    healthMarkersByIndex.set(marker.insertionIndex, markers);
  }
  const renderContinuumEnd = (
    marker: (typeof continuumEnds)[number],
  ): string => {
    const time = formatTime(marker.start);
    const detail = [
      "Continuum Shift",
      `Continuum Split ended automatically at ${time}`,
      "Cooldown state restored",
    ].join("\n");
    return `<div class="rot-skill rot-injected" title="${esc(detail)}"
            style="--att-border:#d6b46b">
            <img src="${esc(ACTION_ICONS["Continuum Shift"])}" alt="" />
            <span class="rot-injected-badge">AUTO</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };
  const renderHealthMarker = (
    marker: (typeof healthMarkers)[number],
  ): string => {
    const time = formatTime(marker.start);
    const label = `${marker.healthPercent}%`;
    const detail = [
      `Target reached ${label} health`,
      `At ${time}`,
      `${Math.round(marker.damage).toLocaleString()} cumulative damage`,
    ].join("\n");
    return `<div class="rot-skill rot-injected rot-health-marker"
            title="${esc(detail)}" style="--att-border:#d96b6b">
            <img src="${esc(COMBAT_START_ICON)}" alt="" />
            <span class="rot-injected-badge">${esc(label)}</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  let timelineHtml = rows
    .map((row, rowNumber) => {
      const weapons =
        row.weaponSet === 1 ? app.build.weapons : app.build.alternateWeapons;
      const weaponLabel =
        row.weaponLine || weapons.filter(Boolean).join("/") || "Unequipped";
      const rowLabel = row.weaponLine
        ? row.weaponLine.replace(/ Kit$/, "")
        : `W${row.weaponSet}`;
      const rowTitle = row.weaponLine
        ? `${row.weaponLine} weapon line`
        : `Weapon set ${row.weaponSet}: ${weaponLabel}`;
      const rowItems: string[] = [];
      row.skills.forEach(({ entry, index }) => {
        for (const marker of healthMarkersByIndex.get(index) || []) {
          rowItems.push(renderHealthMarker(marker));
        }
        for (const marker of continuumEndsByIndex.get(index) || []) {
          rowItems.push(renderContinuumEnd(marker));
        }
        const item = timelineItem(entry);
        const explicitSkillId =
          item.skillId == null ? null : Number(item.skillId);
        const skill =
          explicitSkillId !== null && Number.isFinite(explicitSkillId)
            ? app.skillById.get(explicitSkillId)
            : app.skillByName.get(String(item.name));
        const step = steps.get(index);
        const invalid = Boolean(step?.invalid);
        const display =
          item.name === "__wait"
            ? "Wait"
            : item.name === "__combat_start"
              ? "Combat Start"
              : item.name === "__cooldown_reset"
                ? "Cooldown Reset"
                : item.name;
        const defaultIcon =
          item.name === "__wait"
            ? WAIT_ICON
            : item.name === "__combat_start"
              ? COMBAT_START_ICON
              : item.name === "__cooldown_reset"
                ? COOLDOWN_RESET_ICON
                : skill?.icon ||
                  (skill?.name ? ACTION_ICONS[skill.name] : "") ||
                  PLACEHOLDER_ICON;
        const icon =
          app.profession.ui.timelineSkillIcon?.({
            entry: item,
            index,
            rotation: app.build.rotation,
            build: app.build,
            skill,
            defaultIcon,
          }) || defaultIcon;
        const time = step && !invalid ? formatTime(step.start) : "";
        const resourceSpend = resourceSpends.get(index);
        const resourceSingular = resourceSpend?.resource.endsWith("s")
          ? resourceSpend.resource.slice(0, -1)
          : resourceSpend?.resource;
        const resourceSpendTiming =
          resourceSpend?.resource === "blades" ? "cast end" : "cast start";
        const resourceLabel = resourceSpend
          ? `${resourceSpend.count} ${
              resourceSpend.count === 1
                ? resourceSingular
                : resourceSpend.resource
            } consumed at ${resourceSpendTiming}`
          : "";
        const resourceShortLabel = resourceSpend
          ? `${resourceSpend.count}${
              resourceSpend.resource === "blades"
                ? "B"
                : resourceSpend.resource === "clones"
                  ? "C"
                  : "R"
            }`
          : "";
        const skillTooltip =
          step &&
          !invalid &&
          item.name !== "__wait" &&
          item.name !== "__combat_start" &&
          item.name !== "__cooldown_reset"
            ? formatTimelineSkillTooltip(
                display,
                step,
                castOrdinals.get(index),
                formatTime,
              )
            : display;
        const titleSuffix = invalid
          ? `\n${step?.invalidReason || "Not valid here — will not be simulated"}`
          : step &&
              (item.name === "__wait" ||
                item.name === "__combat_start" ||
                item.name === "__cooldown_reset")
            ? `\n${formatTimelineCastDetails(step, formatTime)}`
            : "";
        const resourceTitle = resourceLabel ? `\n${resourceLabel}` : "";
        const concurrentLabel =
          item.offset != null
            ? formatConcurrentTimelineBadge(item.offset, time)
            : "";
        const interruptLabel =
          item.interruptMs != null
            ? formatInterruptTimelineBadge(item.interruptMs, time)
            : "";
        rowItems.push(`<div class="rot-skill${item.offset != null ? " rot-concurrent" : ""}${invalid ? " rot-invalid" : ""}" draggable="true"
                    data-idx="${index}" title="${esc(skillTooltip)}${titleSuffix}${resourceTitle}" style="--att-border:#9d7bd0">
                    <img src="${esc(icon)}" alt="" />
                    <span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>
                    ${invalid ? '<span class="rot-invalid-badge" title="Invalid — not simulated">✕</span>' : ""}
                    ${
                      resourceSpend
                        ? `<span class="rot-resource-spend-badge"
                        title="${esc(resourceLabel)}" aria-label="${esc(resourceLabel)}">${esc(resourceShortLabel)}</span>`
                        : ""
                    }
                    ${time && item.offset == null && item.interruptMs == null ? `<span class="rot-time">${time}</span>` : ""}
                    ${
                      item.offset != null
                        ? `<span class="rot-offset-badge rot-timed-action-badge" data-idx="${index}"
                        title="Delay ${item.offset}ms; cast at ${esc(time)}">${esc(concurrentLabel)}</span>`
                        : ""
                    }
                    ${
                      item.interruptMs != null
                        ? `<span class="rot-gapfill-badge rot-interrupt-badge rot-timed-action-badge"
                        data-idx="${index}" title="Interrupt after ${item.interruptMs}ms; cast at ${esc(time)}">${esc(interruptLabel)}</span>`
                        : ""
                    }
                    ${item.waitMs != null ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${index}">⌛${item.waitMs}ms</span>` : ""}
                </div>`);
      });
      if (rowNumber === rows.length - 1) {
        for (const marker of healthMarkersByIndex.get(
          app.build.rotation.length,
        ) || []) {
          rowItems.push(renderHealthMarker(marker));
        }
        for (const marker of continuumEndsByIndex.get(
          app.build.rotation.length,
        ) || []) {
          rowItems.push(renderContinuumEnd(marker));
        }
      }
      const skills = rowItems
        .map(
          (item, index) =>
            `${index ? '<span class="rot-arrow">→</span>' : ""}${item}`,
        )
        .join("");
      const finalSkill = row.skills.at(-1);
      const insertAt = finalSkill ? finalSkill.index + 1 : 0;
      return `<div class="rot-row" style="--row-color:#9d7bd0">
            <div class="rot-row-label" title="${esc(rowTitle)}">${esc(rowLabel)}</div>
            <div class="rot-row-skills" data-insert-idx="${insertAt}">${skills}</div>
        </div>`;
    })
    .join("");

  const procColors: Readonly<Record<string, string>> = {
    relic_proc: "#ddaa33",
    trait_proc: "#77cc77",
    skill_proc: "#bb88ff",
  };
  const procSteps = [...(app.results?.procSteps || [])].sort(
    (a, b) => a.start - b.start,
  );
  if (procSteps.length) {
    const procVisibility = syncProcVisibility(app, procSteps);
    const procOptions = [
      ...new Map(procSteps.map((proc) => [procFilterKey(proc), proc])).values(),
    ].sort((a, b) => procFilterLabel(a).localeCompare(procFilterLabel(b)));
    const visibleProcCount = procOptions.filter((proc) =>
      procVisibility.has(procFilterKey(proc)),
    ).length;
    const procs = groupConsecutiveProcSteps(procSteps)
      .map((group) => {
        const proc = group.steps[0];
        if (!proc) return "";
        const { key } = group;
        const icon = resolveProcIcon(app, proc) || PLACEHOLDER_ICON;
        const type =
          proc.type === "relic_proc"
            ? "Relic"
            : proc.type === "skill_proc"
              ? "Skill"
              : "Trait";
        const time = formatTime(proc.start);
        const count = group.steps.length;
        const badgeLabel = procBadgeLabel(group.steps);
        const stackLabel = procStackLabel(group.steps.at(-1) || proc);
        const detail =
          count === 1
            ? [
                proc.skill,
                `${type} proc at ${time}`,
                proc.sourceSkill ? `Triggered by ${proc.sourceSkill}` : "",
                proc.detail || "",
              ]
                .filter(Boolean)
                .join("\n")
            : [
                proc.skill,
                `${type} proc x${count}`,
                ...group.steps.map((step, index) =>
                  [
                    `${index + 1}. ${formatTime(step.start)}`,
                    step.sourceSkill ? `Triggered by ${step.sourceSkill}` : "",
                    step.detail || "",
                  ]
                    .filter(Boolean)
                    .join(" - "),
                ),
              ].join("\n");
        return `<div class="proc-icon" data-proc-key="${esc(key)}"${procVisibility.has(key) ? "" : " hidden"} title="${esc(detail)}"
                style="--proc-color:${procColors[proc.type] || "#9d7bd0"}">
                <img src="${esc(icon)}" alt="" />
                ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ""}
                ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ""}
                <span class="proc-time">${time}</span>
            </div>`;
      })
      .join("");
    if (procElement)
      procElement.innerHTML = `<details class="rotation-procs-wrap"${procPanelWasOpen ? " open" : ""}>
            <summary>Procs (${procSteps.length} activation${procSteps.length === 1 ? "" : "s"})</summary>
            <div class="rotation-procs-content">
                <details class="proc-filter"${app.procFilterOpen ? " open" : ""}>
                    <summary title="Choose which proc types are shown">Visible <span class="proc-filter-count">${visibleProcCount}/${procOptions.length}</span></summary>
                    <div class="proc-filter-menu">
                        ${procOptions
                          .map((proc) => {
                            const key = procFilterKey(proc);
                            return `<label class="proc-filter-option">
                                <input type="checkbox" data-proc-key="${esc(key)}"${procVisibility.has(key) ? " checked" : ""}>
                                <span>${esc(procFilterLabel(proc))}</span>
                            </label>`;
                          })
                          .join("")}
                    </div>
                </details>
                <div class="proc-icons-row">${procs}</div>
            </div>
        </details>`;
  } else if (procElement) procElement.innerHTML = "";
  element.innerHTML = timelineHtml;

  const procFilter =
    procElement?.querySelector<HTMLDetailsElement>(".proc-filter") || null;
  const activeProcVisibility = app.procVisibility || new Set();
  if (procFilter && procElement) {
    procFilter.addEventListener("toggle", () => {
      app.procFilterOpen = procFilter.open;
    });
    procFilter.querySelectorAll("input[data-proc-key]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.addEventListener("change", () => {
        const key = input.dataset.procKey || "";
        if (input.checked) activeProcVisibility.add(key);
        else activeProcVisibility.delete(key);
        app.procFilterOpen = true;
        procElement
          .querySelectorAll(".proc-icon[data-proc-key]")
          .forEach((procIcon) => {
            if (!(procIcon instanceof HTMLElement)) return;
            procIcon.hidden = !activeProcVisibility.has(
              procIcon.dataset.procKey || "",
            );
          });
        const count = procFilter.querySelector(".proc-filter-count");
        if (count) {
          const visible = procFilter.querySelectorAll(
            "input[data-proc-key]:checked",
          ).length;
          const total = procFilter.querySelectorAll(
            "input[data-proc-key]",
          ).length;
          count.textContent = `${visible}/${total}`;
        }
      });
    });
  }

  const procIconsRow =
    procElement?.querySelector<HTMLElement>(".proc-icons-row") || null;
  if (procIconsRow) {
    const applyProcHighlight = (): void => {
      const icons = [
        ...procIconsRow.querySelectorAll(".proc-icon[data-proc-key]"),
      ];
      const key = app.procHighlightKey;
      const active =
        !!key &&
        icons.some(
          (icon) => icon instanceof HTMLElement && icon.dataset.procKey === key,
        );
      if (!active) app.procHighlightKey = null;
      icons.forEach((icon) => {
        if (!(icon instanceof HTMLElement)) return;
        const match = active && icon.dataset.procKey === key;
        icon.classList.toggle("proc-highlight", match);
        icon.classList.toggle("proc-faded", active && !match);
      });
    };
    procIconsRow
      .querySelectorAll(".proc-icon[data-proc-key]")
      .forEach((icon) => {
        if (!(icon instanceof HTMLElement)) return;
        icon.addEventListener("click", () => {
          const key = icon.dataset.procKey;
          app.procHighlightKey = app.procHighlightKey === key ? null : key;
          applyProcHighlight();
        });
      });
    applyProcHighlight();
  }

  bindTimelineInteractions(element, timelineInteractionOptions(app));
}
