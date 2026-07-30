import {
  downloadJson,
  getBuildExportPayload,
  getRotationItems,
  readJsonFile,
} from "./files.js";
import {
  createDefaultBuild,
  replaceBuildConfiguration,
} from "./persistence.js";

import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type { ProfessionAppState } from "../profession/types.js";

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required page control #${id} is missing.`);
  return element;
}

function requiredValueControl(
  id: string,
): HTMLInputElement | HTMLSelectElement {
  const element = requiredElement(id);
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement)
  ) {
    throw new TypeError(`Page control #${id} must expose a value.`);
  }
  return element;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function bindPageControls(app: ProfessionAppState): void {
  const attributeWeaponSet = requiredValueControl("attribute-weapon-set");
  attributeWeaponSet.addEventListener("change", () => {
      app.attributeWeaponSet =
        Number(attributeWeaponSet.value) === 2 ? 2 : 1;
      app.adapter.recalculate(app);
      app.renderAttributes();
    });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (
      target instanceof Element &&
      !target.closest(".skill-bar-slot, .skill-bar-inspection-slot")
    ) {
      document
        .querySelectorAll(".sbar-dropdown.open")
        .forEach((drop) => drop.classList.remove("open"));
    }
  });
  requiredElement("btn-sim-clear").addEventListener("click", () => {
    app.build.rotation = [];
    app.changed(false);
  });
  requiredElement("btn-sim-rerun")
    .addEventListener("click", () => app.changed(false));
  requiredElement("btn-export-build")
    .addEventListener("click", () =>
      downloadJson(
        app.adapter.filenames.build,
        getBuildExportPayload(app.build),
      ),
    );
  const importFileInput = requiredElement("import-file-input");
  if (!(importFileInput instanceof HTMLInputElement)) {
    throw new TypeError("#import-file-input must be a file input.");
  }
  requiredElement("btn-import-build")
    .addEventListener("click", () =>
      importFileInput.click(),
    );
  importFileInput.addEventListener("change", async () => {
      const file = importFileInput.files?.[0];
      if (!file) return;
      try {
        app.build = replaceBuildConfiguration(
          await readJsonFile(file),
          app.build,
          app.adapter,
        );
        app.changed();
      } catch (error) {
        alert(errorMessage(error));
      }
    });
  requiredElement("btn-export-rotation")
    .addEventListener("click", () =>
      downloadJson(app.adapter.filenames.rotation, {
        rotation: app.build.rotation,
      }),
    );
  const rotationFileInput = requiredElement("rotation-file-input");
  if (!(rotationFileInput instanceof HTMLInputElement)) {
    throw new TypeError("#rotation-file-input must be a file input.");
  }
  requiredElement("btn-import-rotation")
    .addEventListener("click", () =>
      rotationFileInput.click(),
    );
  rotationFileInput.addEventListener("change", async () => {
      const file = rotationFileInput.files?.[0];
      if (!file) return;
      try {
        const imported = await readJsonFile(file);
        const rotation = getRotationItems(imported);
        if (!rotation) {
          throw new Error("Rotation array missing.");
        }
        app.build.rotation = rotation as LegacyRotationItem[];
        app.changed(false);
      } catch (error) {
        alert(errorMessage(error));
      }
    });
  const targetArmor = requiredValueControl("target-armor");
  targetArmor.addEventListener("change", () => {
      app.build.targetArmor = Math.max(
        1,
        Number(targetArmor.value) || 2597,
      );
      app.changed(false);
    });
  const targetHealth = requiredValueControl("target-hp");
  targetHealth.addEventListener("change", () => {
    app.build.targetHealth = Math.max(0, Number(targetHealth.value) || 0);
    targetHealth.value = String(app.build.targetHealth);
    app.changed(false);
  });
  requiredElement("btn-reset-build").addEventListener("click", () => {
    if (!confirm(app.adapter.resetPrompt)) return;
    app.build = createDefaultBuild(app.adapter);
    app.changed();
  });
}
