export function addRotation(app, name, options = {}) {
  const skillId = options.skillId == null ? null : Number(options.skillId);
  const skill = Number.isFinite(skillId)
    ? app.skillById.get(skillId)
    : app.skillByName.get(name);
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const resolvedOptions =
    defaultInterruptMs != null && options.interruptMs == null
      ? { interruptMs: defaultInterruptMs, ...options }
      : options;
  const item = Object.keys(resolvedOptions).length
    ? { name, ...resolvedOptions }
    : name;
  app.build.rotation.push(item);
  app.changed(false);
}
