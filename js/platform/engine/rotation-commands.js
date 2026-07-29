// Rotation normalization utilities. They keep the scheduler focused on one
// canonical command format while the app layer and importers continue to feed
// legacy names and convenience shorthands.

/**
 * Coerces timing fields into non-negative millisecond values.
 */
function finiteMilliseconds(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${field} must be a non-negative number.`);
  }
  return number;
}

/**
 * Converts one rotation entry into the canonical scheduler command shape.
 */
export function normalizeRotationCommand(entry, catalog = null) {
  if (typeof entry === "number") return { type: "cast", skillId: entry };
  if (typeof entry === "string") {
    if (entry === "__combat_start") return { type: "combat-start" };
    if (entry === "__cooldown_reset") return { type: "cooldown-reset" };
    if (entry === "__wait") return { type: "wait", durationMs: 0 };
    const skill = catalog?.skillsByName?.get(entry);
    return skill
      ? { type: "cast", skillId: skill.id }
      : { type: "cast", skillId: entry };
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError(
      "Rotation command must be a skill, wait, cooldown-reset, " +
        "or combat-start entry.",
    );
  }

  if (entry.type === "cooldown-reset" || entry.name === "__cooldown_reset") {
    return { type: "cooldown-reset" };
  }
  if (entry.type === "combat-start" || entry.name === "__combat_start") {
    const command = { type: "combat-start" };
    const concurrent = entry.concurrentOffsetMs ?? entry.offset;
    if (concurrent != null) {
      command.concurrentOffsetMs = finiteMilliseconds(
        concurrent,
        "Concurrent offset",
      );
    }
    return command;
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
  const skillId =
    entry.skillId ??
    entry.id ??
    catalog?.skillsByName?.get(entry.name)?.id ??
    entry.name;
  if (skillId === undefined || skillId === null || skillId === "") {
    throw new TypeError("Cast command requires skillId.");
  }
  const command = { type: "cast", skillId };
  const concurrent = entry.concurrentOffsetMs ?? entry.offset;
  const interrupt = entry.interruptAfterMs ?? entry.interruptMs;
  if (concurrent != null) {
    command.concurrentOffsetMs = finiteMilliseconds(
      concurrent,
      "Concurrent offset",
    );
  }
  if (interrupt != null) {
    command.interruptAfterMs = finiteMilliseconds(
      interrupt,
      "Interrupt duration",
    );
  }
  return command;
}

/**
 * Normalizes an entire rotation, optionally dropping malformed entries when the
 * caller is doing best-effort migration instead of strict scheduling.
 */
export function normalizeRotation(
  rotation,
  catalog = null,
  { strict = false } = {},
) {
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

/**
 * Converts a canonical command back into the app's legacy persisted shape.
 */
export function toLegacyRotationEntry(command, catalog) {
  if (command.type === "cooldown-reset") {
    return { name: "__cooldown_reset" };
  }
  if (command.type === "combat-start") {
    const entry = { name: "__combat_start" };
    if (command.concurrentOffsetMs != null) {
      entry.offset = command.concurrentOffsetMs;
    }
    return entry;
  }
  if (command.type === "wait") {
    return { name: "__wait", waitMs: command.durationMs };
  }
  const skill = catalog?.skillsById?.get(command.skillId);
  const entry = { name: skill?.name ?? command.skillId };
  if (
    skill
    && catalog.skills?.some(candidate =>
      candidate.id !== skill.id && candidate.name === skill.name)
  ) {
    entry.skillId = command.skillId;
  }
  if (command.concurrentOffsetMs != null)
    entry.offset = command.concurrentOffsetMs;
  if (command.interruptAfterMs != null)
    entry.interruptMs = command.interruptAfterMs;
  return entry;
}
