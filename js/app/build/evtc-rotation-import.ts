import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type { ProfessionAppState } from "../profession/types.js";

export interface ImportedEvtcRotation {
  readonly rotation: readonly LegacyRotationItem[];
  readonly actionCount: number;
  readonly warnings: readonly string[];
  readonly playerLabel: string;
}

/** True when a selected rotation file should use the existing JSON importer. */
export function isJsonRotationFile(file: Pick<File, "name" | "type">): boolean {
  return (
    file.type.toLowerCase() === "application/json" ||
    file.name.toLowerCase().endsWith(".json")
  );
}

/** Reads EVTC/ZIP bytes and reconstructs the matching active build's rotation. */
export async function readEvtcRotationFile(
  file: File,
  app: ProfessionAppState,
): Promise<ImportedEvtcRotation> {
  const [{ decompressEvtcInput }, { parseEvtc }, rotationModule] =
    await Promise.all([
      import("../../evtc-analyzer/decompression.js"),
      import("../../evtc-analyzer/parser.js"),
      import("../../evtc-analyzer/rotation/index.js"),
    ]);
  const expanded = await decompressEvtcInput(await file.arrayBuffer());
  const log = parseEvtc(expanded);
  const activeSpecialization = app.adapter
    .eliteSpecialization(app.build)
    .trim()
    .toLowerCase();
  const players = rotationModule.detectEvtcRotationPlayers(log);
  const matchingPlayers = players.filter(
    (player) =>
      player.professionId === app.profession.id &&
      player.specializationId === activeSpecialization,
  );
  if (!matchingPlayers.length) {
    const recorded = players
      .map(
        (player) =>
          `${player.character} (${player.professionName} ${player.specializationName})`,
      )
      .join(", ");
    throw new Error(
      `This log has no ${app.profession.name} ${app.adapter.eliteSpecialization(app.build)} player.` +
        (recorded ? ` Recorded players: ${recorded}.` : ""),
    );
  }
  if (
    matchingPlayers.length > 1 &&
    matchingPlayers[0].recordedActionCount ===
      matchingPlayers[1].recordedActionCount
  ) {
    throw new Error(
      "Multiple matching players have the same recorded action count. " +
        "Use the EVTC reconstruction CLI with --player=<address>.",
    );
  }
  const selected = matchingPlayers[0];
  // Forward active build mechanics when the full app adapter is available;
  // lightweight parser consumers can still use the build's resource default.
  const professionConfig = app.adapter.simulationConfig?.(app) || {
    initialTomePages: (
      app.build as ProfessionAppState["build"] & {
        readonly initialTomePages?: number;
      }
    ).initialTomePages,
  };
  const result = rotationModule.reconstructEvtcRotation(
    log,
    app.activeCatalog,
    {
      playerAddress: selected.address,
      selectedSkillNames: Object.values(app.build.selectedSkills || {}),
      selectedSkillIds: [
        ...((app.build as { selectedMorphSkillIds?: readonly number[] })
          .selectedMorphSkillIds || []),
      ],
      professionConfig,
    },
  );
  return {
    rotation: result.rotation as readonly LegacyRotationItem[],
    actionCount: result.actions.length,
    warnings: result.warnings,
    playerLabel: `${selected.character} (${selected.account || selected.address})`,
  };
}
