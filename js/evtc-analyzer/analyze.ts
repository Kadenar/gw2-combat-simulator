import { EvtcAnalysisContext } from "./context.js";
import { decompressEvtcInput } from "./decompression.js";
import { analyzeGenericCombat } from "./generic-analysis.js";
import { parseEvtc } from "./parser.js";
import { detectPlayers, resolvePlayer } from "./player-detection.js";
import { loadEvtcProfessionAnalyzers } from "./professions/registry.js";
import { validateGolemEncounter } from "./validation.js";
import type {
  EncounterValidationResult,
  EvtcAnalysisResult,
  ParsedEvtc,
  PlayerSelectionResult,
} from "./types.js";

export type EvtcProgressStage =
  "decompressing" | "parsing" | "validating" | "detecting-player" | "analyzing";

export interface PreparedEvtcAnalysis {
  readonly log: ParsedEvtc;
  readonly encounter: EncounterValidationResult;
  readonly playerSelection: PlayerSelectionResult;
}

export async function prepareEvtcAnalysis(
  input: ArrayBuffer | Uint8Array,
  onProgress: (stage: EvtcProgressStage) => void = () => undefined,
): Promise<PreparedEvtcAnalysis> {
  onProgress("decompressing");
  const evtc = await decompressEvtcInput(input);
  onProgress("parsing");
  const log = parseEvtc(evtc);
  onProgress("validating");
  const encounter = validateGolemEncounter(log);
  onProgress("detecting-player");
  const playerSelection = detectPlayers(log, encounter);
  return { log, encounter, playerSelection };
}

export async function analyzePreparedEvtc(
  prepared: PreparedEvtcAnalysis,
  requestedPlayerAddress?: string,
  onProgress: (stage: EvtcProgressStage) => void = () => undefined,
): Promise<EvtcAnalysisResult> {
  const player = resolvePlayer(
    prepared.playerSelection,
    requestedPlayerAddress,
  );
  onProgress("analyzing");
  const context = new EvtcAnalysisContext(
    prepared.log,
    prepared.encounter,
    player,
  );
  const generic = analyzeGenericCombat(context);
  const analyzers = await loadEvtcProfessionAnalyzers(
    player.professionId,
    player.specializationId,
  );
  const profession = analyzers
    .filter(
      (analyzer) =>
        !analyzer.supportedSpecializations ||
        analyzer.supportedSpecializations.includes(player.specializationId),
    )
    .map((analyzer) => analyzer.analyze(context));
  const warnings = [
    ...(prepared.encounter.mapId === null
      ? [
          "This EVTC revision did not expose a map ID; validation used the numeric trigger and target species IDs.",
        ]
      : []),
    ...(profession.length
      ? []
      : [
          `No profession-specific RNG analyzer is available for ${player.professionName}.`,
        ]),
  ];
  return {
    header: prepared.log.header,
    encounter: {
      speciesId: prepared.encounter.golem.speciesId,
      name: prepared.encounter.golem.name,
      mapId: prepared.encounter.mapId,
    },
    player,
    generic,
    profession,
    warnings,
  };
}

export async function analyzeEvtc(
  input: ArrayBuffer | Uint8Array,
  requestedPlayerAddress?: string,
  onProgress?: (stage: EvtcProgressStage) => void,
): Promise<
  | {
      readonly kind: "selection-required";
      readonly prepared: PreparedEvtcAnalysis;
    }
  | { readonly kind: "analysis"; readonly result: EvtcAnalysisResult }
> {
  const prepared = await prepareEvtcAnalysis(input, onProgress);
  if (
    prepared.playerSelection.kind === "selection-required" &&
    !requestedPlayerAddress
  ) {
    return { kind: "selection-required", prepared };
  }
  return {
    kind: "analysis",
    result: await analyzePreparedEvtc(
      prepared,
      requestedPlayerAddress,
      onProgress,
    ),
  };
}
