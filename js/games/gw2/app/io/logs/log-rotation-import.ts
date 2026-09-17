import { selectRotationPlayer } from '#gw2/integrations/logs/lib/rotation/selection.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface AppRotationPlayer {
  readonly character: string;
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly recordedActionCount: number;
}

export interface AppLogReconstructionOptions {
  readonly selectedSkillNames: readonly string[];
  readonly selectedSkillIds: readonly number[];
  readonly professionConfig: Readonly<Record<string, unknown>>;
}

/** Builds the source-neutral catalog and profession inputs used by every application log importer. */
export function appLogReconstructionOptions(
  app: ProfessionAppState,
  fallbackProfessionConfig: Readonly<Record<string, unknown>> = {}
): AppLogReconstructionOptions {
  return {
    selectedSkillNames: Object.values(app.build.selectedSkills || {}),
    selectedSkillIds: [...((app.build as { selectedMorphSkillIds?: readonly number[] }).selectedMorphSkillIds || [])],
    professionConfig: app.adapter.simulationConfig?.(app) || fallbackProfessionConfig
  };
}

/** Selects the strongest matching player with the same tie contract used by the analyzer registries. */
export function selectActiveBuildLogPlayer<Player extends AppRotationPlayer>(
  players: readonly Player[],
  app: ProfessionAppState,
  sourceLabel: string,
  tieResolution: string
): Player {
  const specializationId = app.adapter.eliteSpecialization(app.build).trim().toLowerCase();
  const matchingPlayers = players.filter(
    (player) => player.professionId === app.profession.id && player.specializationId === specializationId
  );
  const selection = selectRotationPlayer(matchingPlayers);
  if (selection.status === 'selected') return selection.player;
  if (selection.status === 'selection-required') {
    throw new Error(`Multiple matching players have the same recorded action count. ${tieResolution}`);
  }

  const recorded = players
    .map((player) => `${player.character} (${player.professionName} ${player.specializationName})`)
    .join(', ');
  throw new Error(
    `This ${sourceLabel} has no ${app.profession.name} ${app.adapter.eliteSpecialization(app.build)} player.` +
      (recorded ? ` Recorded players: ${recorded}.` : '')
  );
}
