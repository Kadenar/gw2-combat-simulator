import { mountRotationWarnings } from "../../platform/ui/rotation-results.js";
import { formatResultTimelineTime } from "./result-model.js";

export function rotationWarningItems(result) {
  const invalidSteps = new Map();
  for (const step of result?.steps || []) {
    if (!step.invalid || !step.invalidReason) continue;
    const matches = invalidSteps.get(step.invalidReason) || [];
    matches.push(step);
    invalidSteps.set(step.invalidReason, matches);
  }

  return (result?.warnings || []).map((rawWarning) => {
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
    const cleanedMessage = `${message.slice(
      0,
      embeddedTime.index,
    )}${message.slice(embeddedTime.index + embeddedTime[0].length)}`.trim();
    return {
      message: cleanedMessage,
      time: formatResultTimelineTime(Number(embeddedTime[1]) * 1000, result),
    };
  });
}

export function renderWarnings(app) {
  const element = document.getElementById("rotation-warnings");
  if (!element) return;
  const wasOpen =
    element.querySelector(".rotation-warnings-wrap")?.open ?? false;
  const warnings =
    app.build.rotation.length && app.results
      ? rotationWarningItems(app.results)
      : [];
  mountRotationWarnings(element, warnings, { open: wasOpen });
}
