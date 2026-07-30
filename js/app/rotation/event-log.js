import {
  EVENT_LOG_ORDER,
  eventLogCsv,
  mountEventLog,
  normalizeEventLogDescriptor,
} from "../../platform/ui/event-log.js";
import { professionEndState } from "./context.js";
import { effectName, resultCombatReferenceMs } from "./result-model.js";

export function simulationEventLogRows(
  result,
  build = null,
  profession = null,
) {
  const rows = [];
  const professionUi = profession?.ui || profession || {};
  const displayReferenceSeconds = resultCombatReferenceMs(result) / 1000;
  const maximumResource = Number(
    professionEndState(result).resourceDefinition?.maximum || 0,
  );
  const push = (
    at,
    type,
    description,
    className = "",
    phantasmClone = false,
  ) => {
    const displayAt = Number(at || 0) - displayReferenceSeconds;
    rows.push({
      at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
      type,
      description,
      className,
      phantasmClone,
      order: EVENT_LOG_ORDER[type] ?? 80,
    });
  };
  const pushProfessionRow = (event) => {
    const normalized = normalizeEventLogDescriptor(
      professionUi.eventLogRow?.(
        {
          result,
          build,
          profession,
          displayReferenceSeconds,
          maximumResource,
        },
        event,
      ),
    );
    if (normalized === null) return;
    if (normalized) {
      const { flags, ...descriptor } = normalized;
      const displayAt = Number(event.at || 0) - displayReferenceSeconds;
      rows.push({
        at: Math.abs(displayAt) < 1e-12 ? 0 : displayAt,
        ...descriptor,
        phantasmClone: flags.includes("phantasm-clone"),
      });
      return;
    }
    const message = `UNPRESENTED CUSTOM EVENT ${event.type}`;
    globalThis.console?.warn?.(message, event);
    push(event.at, "diagnostic", message, "diagnostic");
  };

  for (const event of result?.events || []) {
    if (event.type === "damage" || event.type === "condition") continue;
    switch (event.type) {
      case "combat_start":
        push(event.at, event.type, "COMBAT START", "trigger");
        break;
      case "action": {
        const durationMs = Math.max(
          0,
          Math.round(
            (Number(event.endsAt || event.at) - Number(event.at || 0)) * 1000,
          ),
        );
        push(event.at, "cast", `CAST ${event.name} (${durationMs}ms)`);
        push(event.endsAt, "cast_end", `END ${event.name}`);
        break;
      }
      case "resource": {
        const amount = Number(event.amount || 0);
        const resource = String(event.resource || "resource");
        const singular = resource.endsWith("s")
          ? resource.slice(0, -1)
          : resource;
        const reason = event.reason ? ` [${event.reason}]` : "";
        const created = (event.created || [])
          .map(
            (clone) =>
              `Clone #${clone.id}${clone.weapon ? ` [${clone.weapon}]` : ""}`,
          )
          .join(", ");
        const isCloneResource = resource === "clones";
        if (amount > 0) {
          push(
            event.at,
            event.type,
            `${singular.toUpperCase()} SPAWNED x${amount} -> ${event.value}/${maximumResource}${reason}${created ? ` (${created})` : ""}`,
            "resource",
            isCloneResource,
          );
        } else {
          push(
            event.at,
            event.type,
            `${resource.toUpperCase()} SPENT x${Math.abs(amount)} -> ${event.value}/${maximumResource}${reason}`,
            "resource",
            isCloneResource,
          );
        }
        break;
      }
      case "marker":
        push(
          event.at,
          event.type,
          `EVENT ${event.name}${event.detail ? ` - ${event.detail}` : ""}`,
          "trigger",
        );
        break;
      case "proc":
        push(
          event.at,
          event.type,
          `${String(event.procType || "effect").toUpperCase()} ${event.name}${event.sourceSkill ? ` [${event.sourceSkill}]` : ""}${event.detail ? ` - ${event.detail}` : ""}`,
          event.procType || "trigger",
        );
        break;
      case "weapon_set":
        push(event.at, "trigger", `WEAPON SET ${event.weaponSet}`, "trigger");
        break;
      case "control":
        push(event.at, "trigger", `CONTROL ${event.skillName}`, "trigger");
        break;
      case "weakness_vulnerability":
        push(
          event.at,
          "trigger",
          `WEAKNESS/VULNERABILITY TRIGGER ${event.skillName}`,
          "trigger",
        );
        break;
      case "peitha":
        if (!build || build.relic === "Peitha") {
          push(
            event.at,
            "trigger",
            `PEITHA TRIGGER ${event.skillName}`,
            "trigger",
          );
        }
        break;
      case "buff":
        push(
          event.at,
          "trigger",
          `BUFF ${effectName(event.kind)} x${event.stacks || 1}${event.duration ? ` (${event.duration}s)` : ""}`,
          "trigger",
        );
        break;
      default:
        if (String(event.type || "").includes(".")) {
          pushProfessionRow(event);
        }
        break;
    }
  }

  for (const event of result?.resolvedEvents || []) {
    if (event.type === "damage") {
      const isCloneHit = event.source === "Clone";
      const source = isCloneHit ? "CLONE HIT" : "HIT";
      push(
        event.at,
        "damage",
        `${source} ${event.name} x${event.hits || 1} -> ${Math.round(Number(event.damage || 0)).toLocaleString()} damage`,
        isCloneHit ? "resource" : "",
        isCloneHit,
      );
    } else if (event.type === "condition") {
      push(
        event.at,
        "condition",
        `CONDITION ${event.condition} x${event.stacks || 1} (${Number(event.duration || 0).toFixed(2)}s) [${event.skillName}]`,
        "condition",
      );
    }
  }

  return rows
    .sort(
      (a, b) =>
        a.at - b.at ||
        a.order - b.order ||
        a.description.localeCompare(b.description),
    )
    .map(({ order, ...row }) => row);
}

export function simulationEventLogCsv(rows) {
  return eventLogCsv(rows);
}

export function renderEventLog(app) {
  const element = document.getElementById("rotation-event-log");
  const result = app.results;
  if (!element || !app.build.rotation.length || !result) {
    if (element) element.innerHTML = "";
    return;
  }
  const eventLog = simulationEventLogRows(result, app.build, app.profession);
  const hasPhantasmClone = eventLog.some((event) => event.phantasmClone);
  mountEventLog(
    element,
    eventLog.map((event) => ({
      ...event,
      rowClassName: event.phantasmClone ? "log-phantasm" : "",
    })),
    {
      title: "Event Log",
      filename: app.adapter?.filenames?.eventLog || "event-log.csv",
      filters: hasPhantasmClone
        ? [
            {
              id: "phantasm",
              label: "Phantasm & Clone only",
              predicate: (event) => event.phantasmClone,
            },
          ]
        : [],
    },
  );
}
