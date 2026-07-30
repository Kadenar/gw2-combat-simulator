import { downloadJson, getBuildExportPayload, readJsonFile } from "./files.js";
import {
  createDefaultBuild,
  replaceBuildConfiguration,
} from "./persistence.js";

export function bindPageControls(app) {
  document
    .getElementById("attribute-weapon-set")
    .addEventListener("change", (event) => {
      app.attributeWeaponSet = Number(event.target.value) === 2 ? 2 : 1;
      app.adapter.recalculate(app);
      app.renderAttributes();
    });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".skill-bar-slot, .skill-bar-inspection-slot")) {
      document
        .querySelectorAll(".sbar-dropdown.open")
        .forEach((drop) => drop.classList.remove("open"));
    }
  });
  document.getElementById("btn-sim-clear").addEventListener("click", () => {
    app.build.rotation = [];
    app.changed(false);
  });
  document
    .getElementById("btn-sim-rerun")
    .addEventListener("click", () => app.changed(false));
  document
    .getElementById("btn-export-build")
    .addEventListener("click", () =>
      downloadJson(
        app.adapter.filenames.build,
        getBuildExportPayload(app.build),
      ),
    );
  document
    .getElementById("btn-import-build")
    .addEventListener("click", () =>
      document.getElementById("import-file-input").click(),
    );
  document
    .getElementById("import-file-input")
    .addEventListener("change", async (event) => {
      if (!event.target.files[0]) return;
      try {
        app.build = replaceBuildConfiguration(
          await readJsonFile(event.target.files[0]),
          app.build,
          app.adapter,
        );
        app.changed();
      } catch (error) {
        alert(error.message);
      }
    });
  document
    .getElementById("btn-export-rotation")
    .addEventListener("click", () =>
      downloadJson(app.adapter.filenames.rotation, {
        rotation: app.build.rotation,
      }),
    );
  document
    .getElementById("btn-import-rotation")
    .addEventListener("click", () =>
      document.getElementById("rotation-file-input").click(),
    );
  document
    .getElementById("rotation-file-input")
    .addEventListener("change", async (event) => {
      if (!event.target.files[0]) return;
      try {
        const imported = await readJsonFile(event.target.files[0]);
        app.build.rotation = Array.isArray(imported)
          ? imported
          : imported.rotation;
        if (!Array.isArray(app.build.rotation))
          throw new Error("Rotation array missing.");
        app.changed(false);
      } catch (error) {
        alert(error.message);
      }
    });
  document
    .getElementById("target-armor")
    .addEventListener("change", (event) => {
      app.build.targetArmor = Math.max(1, Number(event.target.value) || 2597);
      app.changed(false);
    });
  document.getElementById("target-hp").addEventListener("change", (event) => {
    app.build.targetHealth = Math.max(0, Number(event.target.value) || 0);
    event.target.value = app.build.targetHealth;
    app.changed(false);
  });
  document.getElementById("btn-reset-build").addEventListener("click", () => {
    if (!confirm(app.adapter.resetPrompt)) return;
    app.build = createDefaultBuild(app.adapter);
    app.changed();
  });
}
