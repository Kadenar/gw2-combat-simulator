import type { ProfessionAppState } from '#gw2/app/types.js';
import { createGolemPresentation } from '#gw2/app/presentation/golem.js';
import { createBossPresentation } from '#gw2/app/presentation/boss.js';
import type { WorkspacePresentation } from '#gw2/app/presentation/model.js';

/** Select workspace policy at the application boundary before shared views receive their prepared presentation. */
export function createWorkspacePresentation(app: Pick<ProfessionAppState, 'workspace'>): WorkspacePresentation {
  const scenario = app.workspace?.scenario;
  return scenario ? createBossPresentation(scenario) : createGolemPresentation();
}
