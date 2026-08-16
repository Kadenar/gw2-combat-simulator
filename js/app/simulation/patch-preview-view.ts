import { skillBreakdownRows } from "../rotation/result-model.js";
import type {
  PatchComparison,
  ProfessionAppState,
} from "../profession/types.js";
import type { PatchNote } from "../../platform/gw2/skill-patch.js";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signed(value: number, digits = 0): string {
  const normalized = Math.abs(value) < 10 ** -digits / 2 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function skillDeltas(comparison: PatchComparison) {
  const rows = new Map<
    string,
    { name: string; current: number; preview: number }
  >();
  for (const [version, result] of [
    ["current", comparison.current],
    ["preview", comparison.preview],
  ] as const) {
    for (const row of skillBreakdownRows(result)) {
      const key = `${row.group}|${row.name}`;
      const entry = rows.get(key) || {
        name: row.name,
        current: 0,
        preview: 0,
      };
      entry[version] = row.dps;
      rows.set(key, entry);
    }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, delta: row.preview - row.current }))
    .filter((row) => Math.abs(row.delta) >= 0.05)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

function noteRows(notes: readonly PatchNote[]): string {
  if (!notes.length) {
    return '<p class="patch-preview-empty">No profession-specific notes are authored.</p>';
  }
  return `<ul class="patch-note-list">${notes
    .map(
      (note) => `<li data-status="${escapeHtml(note.status)}">
        <span class="patch-note-status">${escapeHtml(note.status)}</span>
        <span><strong>${escapeHtml(note.subject)}</strong> ${escapeHtml(note.text)}${
          note.reason ? `<small>${escapeHtml(note.reason)}</small>` : ""
        }</span>
      </li>`,
    )
    .join("")}</ul>`;
}

export function mountPatchPreviewControls(app: ProfessionAppState): void {
  const preview = app.profession.preview;
  const header = document.querySelector("body[data-profession] #app > header");
  if (!preview || !header || header.querySelector(".patch-preview-picker")) {
    return;
  }
  const control = document.createElement("div");
  control.className = "patch-preview-picker";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Game data version");

  const caption = document.createElement("span");
  caption.className = "patch-preview-picker-label";
  caption.textContent = "Game data";
  control.append(caption);

  const options = document.createElement("div");
  options.className = "patch-preview-options";
  for (const [patchId, label] of [
    ["current", "Live"],
    [preview.id, preview.label],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "patch-preview-option";
    button.textContent = label;
    button.dataset.patchId = patchId;
    const active = patchId === app.patchId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => {
      app.selectPatch(patchId);
      for (const option of options.querySelectorAll("button")) {
        const selected = option.dataset.patchId === patchId;
        option.classList.toggle("active", selected);
        option.setAttribute("aria-pressed", String(selected));
      }
    });
    options.append(button);
  }
  control.append(options);
  header.prepend(control);
}

export function renderPatchComparison(
  container: HTMLElement,
  app: ProfessionAppState,
): void {
  const preview = app.profession.preview;
  const comparison = app.patchComparison;
  if (!preview || !comparison) return;
  const currentDps = Number(comparison.current.dps || 0);
  const previewDps = Number(comparison.preview.dps || 0);
  const delta = previewDps - currentDps;
  const percent = currentDps === 0 ? 0 : (delta / currentDps) * 100;
  const deltas = skillDeltas(comparison);
  const notes = [
    ...(preview.notes || []),
    ...(preview.professions?.[app.profession.id]?.notes || []),
  ];
  const applied = notes.filter((note) => note.status === "applied").length;
  const selectedLabel =
    app.patchId === preview.id ? preview.label : "Live game data";
  const section = document.createElement("section");
  section.className = "patch-comparison";
  section.setAttribute("aria-label", "Patch preview comparison");
  section.innerHTML = `
    <div class="patch-comparison-header">
      <div>
        <span class="patch-comparison-eyebrow">Patch comparison</span>
        <h3>Live vs ${escapeHtml(preview.label)}</h3>
      </div>
      <span class="patch-selected-badge">Showing ${escapeHtml(selectedLabel)}</span>
    </div>
    <div class="patch-comparison-metrics">
      <div><span>Live DPS</span><strong>${Math.round(currentDps).toLocaleString()}</strong></div>
      <div><span>Preview DPS</span><strong>${Math.round(previewDps).toLocaleString()}</strong></div>
      <div class="${delta > 0 ? "positive" : delta < 0 ? "negative" : ""}">
        <span>Difference</span><strong>${signed(delta)} <small>(${signed(percent, 2)}%)</small></strong>
      </div>
    </div>
    <details class="patch-skill-deltas"${deltas.length ? " open" : ""}>
      <summary>Per-skill DPS changes (${deltas.length})</summary>
      ${
        deltas.length
          ? `<div class="patch-delta-table">${deltas
              .map(
                (row) => `<div>
                  <span>${escapeHtml(row.name)}</span>
                  <span>${Math.round(row.current).toLocaleString()} &rarr; ${Math.round(row.preview).toLocaleString()}</span>
                  <strong class="${row.delta > 0 ? "positive" : "negative"}">${signed(row.delta)}</strong>
                </div>`,
              )
              .join("")}</div>`
          : '<p class="patch-preview-empty">This rotation is unaffected by the applied preview edits.</p>'
      }
    </details>
    <details class="patch-note-ledger">
      <summary>Patch-note coverage (${applied} applied of ${notes.length})</summary>
      ${noteRows(notes)}
    </details>`;
  container.prepend(section);
}
