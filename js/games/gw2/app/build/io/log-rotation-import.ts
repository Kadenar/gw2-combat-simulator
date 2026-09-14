import { selectRotationPlayer } from '#gw2/integrations/logs/lib/rotation/selection.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
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

/** Absorbs scheduler delays into imported idle time in one pass, leaving only ordinary relative waits. */
export function alignImportedRotationWaits(
  rotation: readonly RotationCommand[],
  waitTargets: ReadonlyMap<number, number>,
  app: ProfessionAppState,
  config: Gw2Config
): { rotation: readonly RotationCommand[]; warnings: readonly string[] } {
  // Lightweight reconstruction consumers need no executable profession when only previewing source commands.
  if (!waitTargets.size || !app.adapter.profession) return { rotation, warnings: [] };
  if (config.selectedSkills != null) {
    config = { ...config, selectedSkills: prepareSelectedSkillLoadout(config.selectedSkills) };
  }

  const profession = resolveProfessionRuntime(app.adapter.profession, config);
  const traits = selectedGw2TraitValues(config, profession.catalog);
  const corrected = [...rotation];
  const scheduled = createScheduler({
    profession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config, {
      traits,
      catalog: profession.catalog,
      weaponSkillMatchesSet: profession.ui.weaponSkillMatchesSet as Gw2WeaponSkillMatcher | undefined
    })
  }).run(rotation, (index, startMs, durationMs) => {
    const targetMs = waitTargets.get(index);
    if (targetMs == null) return durationMs;
    const adjustedMs = quantizeGw2ActionTimingMs(targetMs - startMs);
    // Zero-duration waits still synchronize concurrent casts, so keep their serial barrier.
    corrected[index] = { type: 'wait', durationMs: adjustedMs };
    return adjustedMs;
  });
  return { rotation: corrected, warnings: scheduled.warnings };
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
