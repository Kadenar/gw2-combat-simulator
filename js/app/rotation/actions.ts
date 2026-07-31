import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type {
  ProfessionAppState,
  RotationActionOptions,
} from "../profession/types.js";

export function addRotation(
  app: ProfessionAppState,
  name: string,
  options: RotationActionOptions = {},
): void {
  const skillId = options.skillId == null ? null : Number(options.skillId);
  const skill =
    skillId !== null && Number.isFinite(skillId)
      ? app.skillById.get(skillId)
      : app.skillByName.get(name);
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const resolvedOptions =
    defaultInterruptMs != null && options.interruptMs == null
      ? { interruptMs: defaultInterruptMs, ...options }
      : options;
  const item: LegacyRotationItem = Object.keys(resolvedOptions).length
    ? { name, ...resolvedOptions }
    : name;
  app.build.rotation.push(item);
  app.changed(false);
}
