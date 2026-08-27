import { ProfessionApp } from './profession-app.js';
import { loadProfessionAppAdapter } from './profession/registry.js';

export async function bootstrapProfessionApp(root: Document = document): Promise<ProfessionApp> {
  const professionId = root.body.dataset.profession;

  if (!professionId) {
    throw new Error('Profession page is missing data-profession.');
  }

  const adapter = await loadProfessionAppAdapter(professionId);

  if (!adapter) {
    throw new Error(`No native application adapter is registered for "${professionId}".`);
  }

  const app = new ProfessionApp(adapter);
  const globalScope = window as unknown as Record<string, unknown>;
  globalScope.professionApp = app;

  if (adapter.globalName) globalScope[adapter.globalName] = app;
  await app.init();
  return app;
}
