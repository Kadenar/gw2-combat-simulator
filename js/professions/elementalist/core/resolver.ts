import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type {
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../../platform/gw2/types.js";
import {
  isElementalistAttunement,
  type ElementalistCoreState,
} from "./state.js";

export function applyElementalistResolverAttunement(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const profession = context.profession as {
    core?: ElementalistCoreState;
  } & SchedulerRecord;
  const core =
    profession.core || (profession as unknown as ElementalistCoreState);
  if (isElementalistAttunement(event.to)) {
    core.primaryAttunement = event.to;
  }
  core.secondaryAttunement = isElementalistAttunement(event.secondaryAttunement)
    ? event.secondaryAttunement
    : null;
  core.attunementEnteredAt = event.at;
}

export function applyElementalistResolverSignetFire(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const profession = context.profession as {
    core?: ElementalistCoreState;
  } & SchedulerRecord;
  const core =
    profession.core || (profession as unknown as ElementalistCoreState);
  core.signetOfFireDisabledUntil = Number(event.disabledUntil || event.at);
}
