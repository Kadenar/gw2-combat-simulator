import type { LegacyRotationItem } from "../platform/engine/types.js";
import type { ProfessionAppState } from "../app/profession/types.js";
import { enumerateRotationOptimizerCandidates } from "./candidates.js";
import { splitRotationAtCombatStart } from "./normalization.js";
import type {
  RotationOptimizerRequest,
  RotationOptimizerResult,
  RotationOptimizerWorkerResponse,
} from "./types.js";

const controllers = new WeakMap<ProfessionAppState, RotationOptimizerUi>();

function number(value: number): string {
  return Math.round(value).toLocaleString();
}

function seconds(milliseconds: number): string {
  const value = (Math.max(0, milliseconds) / 1000).toFixed(2);
  return `${value.replace(/\.?0+$/, "")}s`;
}

function optimizerSetupRotation(
  rotation: readonly LegacyRotationItem[],
): LegacyRotationItem[] {
  return structuredClone(splitRotationAtCombatStart(rotation).setupRotation);
}

function optimizerCombatRotation(
  rotation: readonly LegacyRotationItem[],
): LegacyRotationItem[] {
  return structuredClone(splitRotationAtCombatStart(rotation).combatRotation);
}

function buildSignature(app: ProfessionAppState): string {
  return JSON.stringify({
    ...app.build,
    rotation: optimizerSetupRotation(app.build.rotation),
  });
}

class RotationOptimizerUi {
  readonly app: ProfessionAppState;
  worker: Worker | null;
  requestId: number;
  requestBuildSignature: string;
  result: RotationOptimizerResult | null;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.worker = null;
    this.requestId = 0;
    this.requestBuildSignature = "";
    this.result = null;
  }

  mount(): void {
    const toolbar = document.querySelector<HTMLElement>(
      ".rotation-panel .rotation-btns",
    );
    const rotationMid = document.querySelector<HTMLElement>(
      ".rotation-panel .rotation-mid",
    );
    if (!toolbar || !rotationMid) return;

    let controls = toolbar.querySelector<HTMLElement>(
      "[data-rotation-optimizer-controls]",
    );
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "rotation-optimizer-controls";
      controls.dataset.rotationOptimizerControls = "";
      controls.innerHTML = `
        <label class="rotation-optimizer-duration">
          <span>Window</span>
          <input
            type="number"
            min="1"
            max="300"
            step="1"
            value="10"
            inputmode="numeric"
            aria-label="Optimization window in seconds"
            data-rotation-optimizer-horizon
          />
          <span aria-hidden="true">s</span>
        </label>
        <button type="button" class="btn btn-io" data-rotation-optimizer-run>
          Optimize Rotation
        </button>`;
      toolbar.prepend(controls);
      controls
        .querySelector<HTMLButtonElement>("[data-rotation-optimizer-run]")
        ?.addEventListener("click", () => {
          if (this.worker) this.cancel();
          else this.run();
        });
    }

    // Hidden for now: the optimizer button and window input are not exposed in
    // the UI while the feature is still in progress. Remove this line to
    // restore the controls. Inline display beats the stylesheet flex layout.
    controls.style.display = "none";

    let panel = document.querySelector<HTMLElement>(
      "[data-rotation-optimizer-panel]",
    );
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "rotation-optimizer-panel";
      panel.dataset.rotationOptimizerPanel = "";
      panel.hidden = true;
      rotationMid.insertAdjacentElement("afterend", panel);
    }

    if (
      this.worker &&
      this.requestBuildSignature !== buildSignature(this.app)
    ) {
      this.cancel("Build changed; optimizer stopped.");
    }
  }

  private controls(): HTMLElement | null {
    return document.querySelector("[data-rotation-optimizer-controls]");
  }

  private panel(): HTMLElement | null {
    return document.querySelector("[data-rotation-optimizer-panel]");
  }

  private setRunning(running: boolean): void {
    const button = this.controls()?.querySelector<HTMLButtonElement>(
      "[data-rotation-optimizer-run]",
    );
    const horizon = this.controls()?.querySelector<HTMLInputElement>(
      "[data-rotation-optimizer-horizon]",
    );
    if (button)
      button.textContent = running ? "Cancel Optimizer" : "Optimize Rotation";
    if (horizon) horizon.disabled = running;
  }

  private showStatus(message: string, kind = "running"): void {
    const panel = this.panel();
    if (!panel) return;
    panel.hidden = false;
    panel.dataset.kind = kind;
    panel.replaceChildren();
    const status = document.createElement("p");
    status.className = "rotation-optimizer-status";
    status.textContent = message;
    panel.append(status);
  }

  private run(): void {
    if (typeof Worker !== "function") {
      this.showStatus(
        "Rotation optimization requires Web Worker support.",
        "error",
      );
      return;
    }
    const candidates = enumerateRotationOptimizerCandidates(this.app);
    if (!candidates.length) {
      this.showStatus("No usable skills were found for this build.", "error");
      return;
    }
    const horizon = this.controls()?.querySelector<HTMLInputElement>(
      "[data-rotation-optimizer-horizon]",
    );
    const requestedSeconds = Number(horizon?.value || 10);
    if (!Number.isFinite(requestedSeconds) || requestedSeconds < 1) {
      this.showStatus(
        "Enter an optimization window of at least 1 second.",
        "error",
      );
      horizon?.focus();
      return;
    }
    const horizonSeconds = Math.min(300, requestedSeconds);
    if (horizon) horizon.value = String(horizonSeconds);
    const horizonMs = Math.round(horizonSeconds * 1000);
    const setupRotation = optimizerSetupRotation(this.app.build.rotation);
    const incumbentRotation = optimizerCombatRotation(this.app.build.rotation);
    const precastActions = Math.max(0, setupRotation.length - 1);
    const request: RotationOptimizerRequest = {
      professionId: this.app.profession.id,
      config: this.app.adapter.simulationConfig(this.app),
      candidates,
      setupRotation,
      incumbentRotation,
      horizonMs,
      evaluationBudget: Math.min(
        20_000,
        Math.max(1_000, Math.round(horizonSeconds * 400)),
      ),
      wallClockLimitMs: Math.min(
        60_000,
        Math.max(15_000, Math.round(horizonSeconds * 600)),
      ),
      seed: 1,
      objective: "fixed-window-dps",
      beamWidth: 20,
      branchLimit: 12,
      enablerReserve: 4,
      maxActions: Math.max(60, Math.ceil(horizonSeconds * 4)),
    };
    const requestId = ++this.requestId;
    this.requestBuildSignature = buildSignature(this.app);
    this.result = null;
    this.worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    this.setRunning(true);
    this.showStatus(
      `Starting ${horizonMs / 1000}s combat search${precastActions ? ` with ${precastActions} precasts` : ""} across ${candidates.length} skills…`,
    );
    this.worker.addEventListener(
      "message",
      (event: MessageEvent<RotationOptimizerWorkerResponse>) => {
        if (
          event.data.requestId !== requestId ||
          requestId !== this.requestId
        ) {
          return;
        }
        if (event.data.progress) {
          const progress = event.data.progress;
          this.showStatus(
            `Combat ${seconds(progress.simulatedTimeMs)} / ${seconds(horizonMs)}${progress.precastDurationMs > 0 ? ` · precast ${seconds(progress.precastDurationMs)}` : ""} · depth ${progress.depth} · ${number(progress.evaluated)} / ${number(progress.evaluationBudget)} evaluations · exact incumbent ${number(progress.bestDps)} DPS · projected ${number(progress.projectedDps)} DPS`,
          );
          return;
        }
        if (event.data.error) {
          this.finish();
          this.showStatus(event.data.error, "error");
          return;
        }
        if (event.data.result) {
          this.result = event.data.result;
          this.finish();
          this.renderResult(event.data.result);
        }
      },
    );
    this.worker.addEventListener(
      "error",
      (event) => {
        if (requestId !== this.requestId) return;
        this.finish();
        const location = event.filename
          ? ` (${event.filename.split("/").pop()}:${event.lineno || 0})`
          : "";
        this.showStatus(
          `${event.message || "Rotation optimizer worker failed."}${location}`,
          "error",
        );
      },
      { once: true },
    );
    try {
      this.worker.postMessage({ requestId, request });
    } catch (error) {
      this.finish();
      this.showStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  }

  private finish(): void {
    this.worker?.terminate();
    this.worker = null;
    this.setRunning(false);
  }

  private cancel(message = "Rotation optimizer cancelled."): void {
    this.requestId += 1;
    this.finish();
    this.showStatus(message, "cancelled");
  }

  private renderResult(result: RotationOptimizerResult): void {
    const panel = this.panel();
    if (!panel) return;
    panel.hidden = false;
    panel.dataset.kind = "success";
    panel.replaceChildren();

    const summary = document.createElement("div");
    summary.className = "rotation-optimizer-summary";
    const heading = document.createElement("strong");
    heading.textContent = result.improved
      ? `Best found: ${number(result.dps)} DPS`
      : `No improvement found: ${number(result.dps)} DPS`;
    const details = document.createElement("span");
    const activeSeconds = Math.round(result.activeDurationMs / 100) / 10;
    const delta = `${result.improvementDps >= 0 ? "+" : ""}${number(result.improvementDps)} DPS (${result.improvementPercent >= 0 ? "+" : ""}${result.improvementPercent.toFixed(2)}%)`;
    details.textContent = `${number(result.totalDamage)} damage over ${result.horizonMs / 1000}s combat · baseline ${number(result.baselineDps)} DPS · ${delta}${result.precastActions ? ` · ${result.precastActions} precasts over ${seconds(result.combatStartTimeMs)}` : ""} · ${result.actions} combat actions covering ${activeSeconds}s${result.completedHorizon ? "" : " plus a terminal wait"} · ${number(result.evaluated)} evaluations · ${result.diagnostics.stopReason}${result.timedOut ? " · time limit reached" : ""}`;
    summary.append(heading, details);

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "btn btn-io";
    apply.textContent = "Apply Rotation";
    apply.disabled =
      result.rotation.length === 0 ||
      this.requestBuildSignature !== buildSignature(this.app);
    apply.addEventListener("click", () => {
      if (this.requestBuildSignature !== buildSignature(this.app)) {
        this.showStatus(
          "Build or setup changed; this optimizer result cannot be applied.",
          "error",
        );
        return;
      }
      this.app.build.rotation = structuredClone(
        result.rotation,
      ) as LegacyRotationItem[];
      this.app.changed(false);
    });
    panel.append(summary, apply);
  }
}

export function mountRotationOptimizer(app: ProfessionAppState): void {
  let controller = controllers.get(app);
  if (!controller) {
    controller = new RotationOptimizerUi(app);
    controllers.set(app, controller);
  }
  controller.mount();
}
