import { EVTC_FILE_LIMITS } from "./decompression.js";
import type {
  DetectedPlayer,
  EvtcAnalysisResult,
  ProfessionAnalysisSection,
} from "./types.js";
import type {
  EvtcWorkerRequest,
  EvtcWorkerResponse,
} from "./worker-contract.js";

interface EvtcAnalyzerElements {
  readonly root: HTMLElement;
  readonly dropzone: HTMLElement;
  readonly input: HTMLInputElement;
  readonly status: HTMLElement;
  readonly reset: HTMLButtonElement;
  readonly selection: HTMLElement;
  readonly results: HTMLElement;
}

export interface EvtcAnalyzerUiOptions {
  readonly createWorker?: () => Worker;
}

const PROGRESS_LABELS = Object.freeze({
  decompressing: "Expanding the log locally…",
  parsing: "Parsing EVTC records locally…",
  validating: "Validating the training-golem encounter…",
  "detecting-player": "Detecting benchmark players…",
  analyzing: "Calculating combat and RNG statistics…",
});

function findElements(root: Document): EvtcAnalyzerElements | null {
  const analyzer = root.querySelector<HTMLElement>("[data-evtc-analyzer]");
  if (!analyzer) return null;
  const dropzone = analyzer.querySelector<HTMLElement>("[data-evtc-dropzone]");
  const input = analyzer.querySelector<HTMLInputElement>("[data-evtc-input]");
  const status = analyzer.querySelector<HTMLElement>("[data-evtc-status]");
  const reset = analyzer.querySelector<HTMLButtonElement>("[data-evtc-reset]");
  const selection = analyzer.querySelector<HTMLElement>(
    "[data-evtc-selection]",
  );
  const results = analyzer.querySelector<HTMLElement>("[data-evtc-results]");
  return dropzone && input && status && reset && selection && results
    ? { root: analyzer, dropzone, input, status, reset, selection, results }
    : null;
}

function element<K extends keyof HTMLElementTagNameMap>(
  root: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const value = root.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    value,
  );
}

function renderSummary(
  root: Document,
  result: EvtcAnalysisResult,
): HTMLElement {
  const summary = element(root, "div", "evtc-stat-grid");
  const totalDamage =
    result.generic.totalOutgoingStrikeDamage +
    result.generic.totalOutgoingConditionDamage;
  const values: readonly [string, string][] = [
    ["Duration", `${(result.generic.combatDurationMs / 1000).toFixed(3)}s`],
    ["Total damage", formatNumber(totalDamage)],
    ["Strike damage", formatNumber(result.generic.totalOutgoingStrikeDamage)],
    [
      "Condition damage",
      formatNumber(result.generic.totalOutgoingConditionDamage),
    ],
    ["Connected hits", formatNumber(result.generic.connectedStrikeHits)],
    ["Critical hits", formatNumber(result.generic.criticalHits)],
    [
      "Critical rate",
      result.generic.criticalHitRate === null
        ? "N/A"
        : `${(result.generic.criticalHitRate * 100).toFixed(2)}%`,
    ],
    ["APM", formatNumber(result.generic.actionsPerMinute.apm)],
  ];
  for (const [label, value] of values) {
    const card = element(root, "div", "evtc-stat");
    card.append(
      element(root, "span", "evtc-stat-label", label),
      element(root, "strong", "", value),
    );
    summary.append(card);
  }
  return summary;
}

function renderApmBreakdown(
  root: Document,
  result: EvtcAnalysisResult,
): HTMLElement {
  const apm = result.generic.actionsPerMinute;
  const fields = element(root, "dl", "evtc-field-grid");
  const rows: readonly [string, string][] = [
    ["Actions per minute", formatNumber(apm.apm)],
    ["Casts per minute", formatNumber(apm.castApm)],
    ["Skill casts", formatNumber(apm.castCount)],
    ["Weapon swaps", formatNumber(apm.weaponSwapCount)],
    ["Actions counted", formatNumber(apm.totalActions)],
    ["Duration basis", `${(apm.durationMs / 1000).toFixed(3)}s`],
  ];
  for (const [label, value] of rows) {
    fields.append(
      element(root, "dt", "", label),
      element(root, "dd", "", value),
    );
  }
  return fields;
}

function renderSkillTable(
  root: Document,
  result: EvtcAnalysisResult,
): HTMLElement {
  const wrapper = element(root, "div", "evtc-table-wrap");
  const table = element(root, "table", "evtc-table");
  const head = element(root, "thead");
  const headRow = element(root, "tr");
  for (const heading of [
    "Skill",
    "Hits",
    "Critical",
    "Non-critical",
    "Damage",
  ]) {
    headRow.append(element(root, "th", "", heading));
  }
  head.append(headRow);
  const body = element(root, "tbody");
  for (const skill of result.generic.perSkill) {
    const row = element(root, "tr");
    const values = [
      skill.skillName,
      formatNumber(skill.connectedHits),
      formatNumber(skill.criticalHits),
      formatNumber(skill.nonCriticalHits),
      formatNumber(skill.strikeDamage + skill.conditionDamage),
    ];
    for (const value of values) row.append(element(root, "td", "", value));
    body.append(row);
  }
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

function renderProfessionSection(
  root: Document,
  section: ProfessionAnalysisSection,
): HTMLElement {
  const card = element(root, "article", "evtc-rng-card");
  const heading = element(root, "div", "evtc-rng-heading");
  const title = element(root, "h4", "", section.title);
  const badge = element(
    root,
    "span",
    `evtc-attribution evtc-attribution-${section.status}`,
    section.status,
  );
  heading.append(title, badge);
  const fields = element(root, "dl", "evtc-field-grid");
  for (const field of section.fields) {
    fields.append(
      element(root, "dt", "", field.label),
      element(root, "dd", "", String(field.value)),
    );
  }
  const evidenceHeading = element(root, "h5", "", "Evidence used");
  const evidence = element(root, "ul", "evtc-detail-list");
  for (const item of section.evidence)
    evidence.append(element(root, "li", "", item));
  const limitationsHeading = element(
    root,
    "h5",
    "",
    "Assumptions and limitations",
  );
  const limitations = element(root, "ul", "evtc-detail-list");
  for (const item of section.assumptions) {
    limitations.append(element(root, "li", "", item));
  }
  card.append(
    heading,
    fields,
    evidenceHeading,
    evidence,
    limitationsHeading,
    limitations,
  );
  return card;
}

function renderAnalysis(
  root: Document,
  container: HTMLElement,
  result: EvtcAnalysisResult,
): void {
  container.replaceChildren();
  const identity = element(root, "div", "evtc-result-heading");
  const copy = element(root, "div");
  copy.append(
    element(root, "p", "landing-eyebrow", "Detected combatant"),
    element(root, "h3", "", result.player.character),
    element(
      root,
      "p",
      "evtc-muted",
      `${result.player.specializationName} ${result.player.professionName} · ${result.encounter.name}`,
    ),
  );
  identity.append(copy);
  const generic = element(root, "section", "evtc-result-section");
  const technicalDetails = element(root, "details", "evtc-technical-details");
  technicalDetails.append(
    element(
      root,
      "summary",
      "",
      "Technical details: per-skill damage and observed rolls",
    ),
    element(root, "h5", "", "Actions per minute"),
    renderApmBreakdown(root, result),
    element(root, "p", "evtc-callout", result.generic.weaponStrength.note),
    renderSkillTable(root, result),
  );
  generic.append(
    element(root, "h3", "", "Combat context"),
    renderSummary(root, result),
    technicalDetails,
  );
  const profession = element(root, "section", "evtc-result-section");
  profession.append(element(root, "h3", "", "Profession RNG analysis"));
  if (!result.profession.length) {
    profession.append(
      element(
        root,
        "p",
        "evtc-muted",
        `No profession-specific analyzer is available for ${result.player.professionName} yet.`,
      ),
    );
  } else {
    for (const analysis of result.profession) {
      for (const section of analysis.sections) {
        profession.append(renderProfessionSection(root, section));
      }
    }
  }
  if (result.warnings.length) {
    const warnings = element(root, "ul", "evtc-detail-list evtc-warnings");
    for (const warning of result.warnings) {
      warnings.append(element(root, "li", "", warning));
    }
    profession.append(warnings);
  }
  container.append(identity, generic, profession);
  container.hidden = false;
}

function renderPlayerSelection(
  root: Document,
  container: HTMLElement,
  players: readonly DetectedPlayer[],
  onSelect: (address: string) => void,
): void {
  container.replaceChildren();
  const heading = element(root, "h3", "", "Choose the benchmark player");
  const explanation = element(
    root,
    "p",
    "evtc-muted",
    "Multiple players dealt meaningful damage to this golem. Select the combatant to analyze.",
  );
  const label = element(root, "label", "evtc-player-label", "Player");
  const select = element(root, "select", "evtc-player-select");
  for (const player of players) {
    const option = element(root, "option");
    option.value = player.address;
    option.textContent = `${player.character} — ${player.specializationName} ${player.professionName} (${formatNumber(player.outgoingDamage)} damage)`;
    select.append(option);
  }
  label.append(select);
  const button = element(root, "button", "evtc-action", "Analyze player");
  button.type = "button";
  button.addEventListener("click", () => onSelect(select.value));
  container.append(heading, explanation, label, button);
  container.hidden = false;
  select.focus();
}

export function bindEvtcAnalyzer(
  root: Document = document,
  options: EvtcAnalyzerUiOptions = {},
): (() => void) | null {
  const ui = findElements(root);
  if (!ui) return null;
  const createWorker =
    options.createWorker ||
    (() =>
      new Worker(new URL("./worker.js", import.meta.url), { type: "module" }));
  let worker: Worker | null = null;
  let requestId = 0;

  const setStatus = (message: string, kind = "progress"): void => {
    ui.status.textContent = message;
    ui.status.dataset.kind = kind;
    ui.status.hidden = false;
  };
  const stopWorker = (): void => {
    worker?.terminate();
    worker = null;
  };
  const reset = (): void => {
    requestId += 1;
    stopWorker();
    ui.input.value = "";
    ui.root.removeAttribute("aria-busy");
    ui.dropzone.hidden = false;
    ui.reset.hidden = true;
    ui.status.hidden = true;
    ui.selection.hidden = true;
    ui.selection.replaceChildren();
    ui.results.hidden = true;
    ui.results.replaceChildren();
  };
  const handleResponse = (event: MessageEvent<EvtcWorkerResponse>): void => {
    const response = event.data;
    if (response.requestId !== requestId) return;
    if (response.type === "progress") {
      setStatus(PROGRESS_LABELS[response.stage]);
      return;
    }
    ui.root.removeAttribute("aria-busy");
    if (response.type === "error") {
      setStatus(response.error.message, "error");
      ui.dropzone.hidden = false;
      stopWorker();
      return;
    }
    if (response.type === "selection-required") {
      setStatus("The log is parsed. Choose a player to continue.", "success");
      renderPlayerSelection(root, ui.selection, response.players, (address) => {
        ui.selection.hidden = true;
        ui.root.setAttribute("aria-busy", "true");
        setStatus("Analyzing the selected player locally…");
        worker?.postMessage({
          type: "select-player",
          requestId,
          playerAddress: address,
        } satisfies EvtcWorkerRequest);
      });
      return;
    }
    setStatus(
      "Analysis complete.",
      "success",
    );
    renderAnalysis(root, ui.results, response.result);
    stopWorker();
  };
  const start = async (file: File): Promise<void> => {
    reset();
    requestId += 1;
    const currentRequest = requestId;
    ui.reset.hidden = false;
    if (file.size > EVTC_FILE_LIMITS.maximumExpandedBytes) {
      setStatus(
        "The selected file exceeds the 512 MiB input safety limit.",
        "error",
      );
      return;
    }
    ui.root.setAttribute("aria-busy", "true");
    setStatus("Reading the file locally…");
    try {
      const buffer = await file.arrayBuffer();
      if (currentRequest !== requestId) return;
      worker = createWorker();
      worker.addEventListener("message", handleResponse);
      worker.addEventListener("error", () => {
        if (currentRequest !== requestId) return;
        ui.root.removeAttribute("aria-busy");
        setStatus("The EVTC analysis worker stopped unexpectedly.", "error");
        stopWorker();
      });
      worker.postMessage(
        {
          type: "analyze",
          requestId,
          fileName: file.name,
          buffer,
        } satisfies EvtcWorkerRequest,
        [buffer],
      );
    } catch (error) {
      ui.root.removeAttribute("aria-busy");
      setStatus(
        error instanceof Error ? error.message : "The file could not be read.",
        "error",
      );
    }
  };
  ui.dropzone.addEventListener("click", () => ui.input.click());
  ui.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ui.input.click();
    }
  });
  ui.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    ui.dropzone.classList.add("is-dragging");
  });
  ui.dropzone.addEventListener("dragleave", () => {
    ui.dropzone.classList.remove("is-dragging");
  });
  ui.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    ui.dropzone.classList.remove("is-dragging");
    const file = event.dataTransfer?.files[0];
    if (file) void start(file);
  });
  ui.input.addEventListener("change", () => {
    const file = ui.input.files?.[0];
    if (file) void start(file);
  });
  ui.reset.addEventListener("click", reset);
  reset();
  return reset;
}

if (typeof document !== "undefined") {
  bindEvtcAnalyzer(document);
}
