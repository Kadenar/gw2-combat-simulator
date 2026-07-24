function finiteMilliseconds(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${field} must be a non-negative number.`);
  }
  return number;
}

export function normalizeRotationCommand(entry, catalog = null) {
  if (typeof entry === "number") return { type: "cast", skillId: entry };
  if (typeof entry === "string") {
    if (entry === "__combat_start") return { type: "combat-start" };
    if (entry === "__wait") return { type: "wait", durationMs: 0 };
    const skill = catalog?.skillsByName?.get(entry);
    return skill
      ? { type: "cast", skillId: skill.id }
      : { type: "cast", skillId: entry };
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Rotation command must be a skill, wait, or combat-start entry.");
  }

  if (entry.type === "combat-start" || entry.name === "__combat_start") {
    return { type: "combat-start" };
  }
  if (entry.type === "wait" || entry.name === "__wait") {
    return {
      type: "wait",
      durationMs: finiteMilliseconds(
        entry.durationMs ?? entry.waitMs ?? 0,
        "Wait duration",
      ),
    };
  }
  const skillId = entry.skillId
    ?? entry.id
    ?? catalog?.skillsByName?.get(entry.name)?.id
    ?? entry.name;
  if (skillId === undefined || skillId === null || skillId === "") {
    throw new TypeError("Cast command requires skillId.");
  }
  const command = { type: "cast", skillId };
  const concurrent = entry.concurrentOffsetMs ?? entry.offset;
  const interrupt = entry.interruptAfterMs ?? entry.interruptMs;
  if (concurrent != null) {
    command.concurrentOffsetMs = finiteMilliseconds(concurrent, "Concurrent offset");
  }
  if (interrupt != null) {
    command.interruptAfterMs = finiteMilliseconds(interrupt, "Interrupt duration");
  }
  return command;
}

export function normalizeRotation(rotation, catalog = null, { strict = false } = {}) {
  if (!Array.isArray(rotation)) {
    if (strict) throw new TypeError("Rotation must be an array.");
    return [];
  }
  const commands = [];
  for (const entry of rotation) {
    try {
      commands.push(normalizeRotationCommand(entry, catalog));
    } catch (error) {
      if (strict) throw error;
    }
  }
  return commands;
}

export function toLegacyRotationEntry(command, catalog) {
  if (command.type === "combat-start") return { name: "__combat_start" };
  if (command.type === "wait") {
    return { name: "__wait", waitMs: command.durationMs };
  }
  const skill = catalog?.skillsById?.get(command.skillId);
  const entry = { name: skill?.name ?? command.skillId };
  if (command.concurrentOffsetMs != null) entry.offset = command.concurrentOffsetMs;
  if (command.interruptAfterMs != null) entry.interruptMs = command.interruptAfterMs;
  return entry;
}
