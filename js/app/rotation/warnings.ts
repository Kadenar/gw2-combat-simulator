import type {
  SchedulerStep,
} from "../../platform/engine/types.js";
import type {
  Gw2SimulationResult,
} from "../../platform/gw2/types.js";
import type {
  ProfessionAppState,
} from "../profession/types.js";
import { mountRotationWarnings } from "../../platform/ui/rotation-warnings.js";
import { formatResultTimelineTime } from "./result-model.js";

export interface RotationWarningItem {
  readonly message: string;
  readonly time: string;
}

export function rotationWarningItems(
  result: Gw2SimulationResult | null | undefined,
): RotationWarningItem[] {
  const invalidSteps = new Map<string, SchedulerStep[]>();
  for (const step of result?.steps || []) {
    if (!step.invalid || !step.invalidReason) continue;
    const matches = invalidSteps.get(step.invalidReason) || [];
    matches.push(step);
    invalidSteps.set(step.invalidReason, matches);
  }

  return (result?.warnings || []).map(rawWarning => {
    const message = String(rawWarning);
    const step = invalidSteps.get(message)?.shift();
    if (step && Number.isFinite(Number(step.start))) {
      return {
        message,
        time: formatResultTimelineTime(step.start, result),
      };
    }

    // Resolver diagnostics carry their absolute simulation time in the
    // message instead of an invalid rotation step.
    const embeddedTime = message.match(
      /(?:^|\s)at\s+(-?\d+(?:\.\d+)?)s(?=[:.,\s]|$)/i,
    );
    if (!embeddedTime) return { message, time: "" };
    const matchIndex = embeddedTime.index ?? 0;
    const cleanedMessage = `${message.slice(
      0,
      matchIndex,
    )}${message.slice(matchIndex + embeddedTime[0].length)}`.trim();
    return {
      message: cleanedMessage,
      time: formatResultTimelineTime(Number(embeddedTime[1]) * 1000, result),
    };
  });
}

export function renderWarnings(app: ProfessionAppState): void {
  const element = document.getElementById("rotation-warnings");
  if (!element) return;
  const details = element.querySelector<HTMLDetailsElement>(
    ".rotation-warnings-wrap",
  );
  const wasOpen = details?.open ?? false;
  const warnings =
    app.build.rotation.length && app.results
      ? rotationWarningItems(app.results)
      : [];
  mountRotationWarnings(element, warnings, { open: wasOpen });
}
