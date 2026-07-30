import type {
  SchedulerRecord,
} from "../../platform/engine/types.js";
import type {
  ProfessionAppResult,
  ProfessionAppState,
} from "../profession/types.js";

export const seconds = (ms: number): string =>
  `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export const professionEndState = (
  result: ProfessionAppResult | null | undefined,
): SchedulerRecord =>
  result?.endState?.profession &&
  typeof result.endState.profession === "object"
    ? result.endState.profession as SchedulerRecord
    : {};

export const activeSpecialization = (
  app: ProfessionAppState,
): string => app.adapter.eliteSpecialization(app.build);
