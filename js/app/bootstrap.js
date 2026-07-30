import { ProfessionApp } from "./profession-app.js";
import { loadProfessionAppAdapter } from "./profession/registry.js";

export async function bootstrapProfessionApp(root = document) {
  const professionId =
    root.body.dataset.profession ||
    root.getElementById("profession-select")?.dataset.activeProfession;
  if (!professionId) {
    throw new Error("Profession page is missing data-profession.");
  }
  const adapter = await loadProfessionAppAdapter(professionId);
  if (!adapter) {
    throw new Error(
      `No native application adapter is registered for "${professionId}".`,
    );
  }
  const app = new ProfessionApp(adapter);
  window.professionApp = app;
  if (adapter.globalName) window[adapter.globalName] = app;
  app.init();
  return app;
}
