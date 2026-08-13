import type {
  ElementalistLegacyRuntimeState,
  ElementalistRuntimeWindowState,
  ElementalistTimingWindowState,
} from "../../types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (value instanceof Map) {
    const next = new Map<unknown, unknown>();
    for (const [key, entry] of value.entries())
      next.set(cloneValue(key), cloneValue(entry));
    return next as T;
  }
  if (value instanceof Set) {
    const next = new Set<unknown>();
    for (const entry of value.values()) next.add(cloneValue(entry));
    return next as T;
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value))
      next[key] = cloneValue(entry);
    return next as T;
  }
  return value;
}

function createRuntimeWindowSnapshot(
  source?:
    ElementalistLegacyRuntimeState | ElementalistTimingWindowState | null,
): ElementalistRuntimeWindowState {
  const runtimeWindowState = source?.runtimeWindowState;
  return {
    arcaneEchoUntil: runtimeWindowState?.arcaneEchoUntil ?? 0,
    signetFirePassiveLostWindows:
      runtimeWindowState?.signetFirePassiveLostWindows
        ? runtimeWindowState.signetFirePassiveLostWindows.map((w) => ({
            from: w.from,
            until: w.until,
          }))
        : [],
  };
}

export function getTimingWindowStateTarget(
  S: ElementalistLegacyRuntimeState,
): ElementalistTimingWindowState {
  const target = S?.schedulerTimingWindowState || S;
  if (target.castUntil === undefined) target.castUntil = 0;
  if (!target.runtimeWindowState) {
    target.runtimeWindowState = createRuntimeWindowSnapshot(target);
  }
  return target as ElementalistTimingWindowState;
}

export function createTimingWindowStateSnapshot(
  source?:
    ElementalistLegacyRuntimeState | ElementalistTimingWindowState | null,
): ElementalistTimingWindowState {
  const target = source?.schedulerTimingWindowState || source || {};
  return {
    castUntil: target.castUntil ?? 0,
    runtimeWindowState: cloneValue(createRuntimeWindowSnapshot(target)),
  };
}

export function restoreTimingWindowState(
  S: ElementalistLegacyRuntimeState,
  timingWindowState?:
    ElementalistLegacyRuntimeState | ElementalistTimingWindowState | null,
): ElementalistTimingWindowState {
  const target = getTimingWindowStateTarget(S);
  const restored = createTimingWindowStateSnapshot(timingWindowState);
  target.castUntil = restored.castUntil;
  target.runtimeWindowState = restored.runtimeWindowState;
  return target;
}

export function createRuntimeWindowState(): ElementalistRuntimeWindowState {
  return createRuntimeWindowSnapshot(null);
}

export function getRuntimeWindowState(
  S: ElementalistLegacyRuntimeState,
): ElementalistRuntimeWindowState {
  return getTimingWindowStateTarget(S).runtimeWindowState;
}

export function getCastUntil(
  S: ElementalistLegacyRuntimeState,
  fallback = 0,
): number {
  const target = getTimingWindowStateTarget(S);
  return target.castUntil ?? fallback;
}

export function setCastUntil(
  S: ElementalistLegacyRuntimeState,
  time: number,
): number {
  const target = getTimingWindowStateTarget(S);
  target.castUntil = time;
  return time;
}

export function getArcaneEchoUntil(
  S: ElementalistLegacyRuntimeState,
  fallback = 0,
): number {
  return getRuntimeWindowState(S).arcaneEchoUntil || fallback;
}

export function setArcaneEchoUntil(
  S: ElementalistLegacyRuntimeState,
  time: number,
): number {
  const target = getTimingWindowStateTarget(S);
  target.runtimeWindowState.arcaneEchoUntil = time;
  return time;
}

export function armArcaneEchoWindow(
  S: ElementalistLegacyRuntimeState,
  startTime: number,
  durationMs: number,
): number {
  return setArcaneEchoUntil(S, startTime + durationMs);
}

export function clearArcaneEchoWindow(
  S: ElementalistLegacyRuntimeState,
): number {
  return setArcaneEchoUntil(S, 0);
}

export function isArcaneEchoActive(
  S: ElementalistLegacyRuntimeState,
  time: number,
): boolean {
  return getArcaneEchoUntil(S, 0) > time;
}

export function addSignetFirePassiveLostWindow(
  S: ElementalistLegacyRuntimeState,
  from: number,
  until: number,
): void {
  const target = getTimingWindowStateTarget(S);
  target.runtimeWindowState.signetFirePassiveLostWindows.push({ from, until });
}

export function isSignetFirePassiveLost(
  S: ElementalistLegacyRuntimeState,
  time: number,
): boolean {
  const windows = getRuntimeWindowState(S).signetFirePassiveLostWindows;
  for (let i = 0; i < windows.length; i++) {
    if (time >= windows[i].from && time < windows[i].until) return true;
  }
  return false;
}
