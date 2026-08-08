import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import type { Gw2TimedBuffApplication } from "../../../../platform/gw2/types.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
} from "../../types.js";
import { soulbeastState } from "./state.js";

export function handleSoulbeastModeEvent(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  soulbeastState.from(context).beastmodeActive = event.active === true;
}

export function handleRangerBoonExtension(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const boons = new Set([
    "aegis",
    "alacrity",
    "fury",
    "might",
    "protection",
    "quickness",
    "regeneration",
    "resistance",
    "resolution",
    "stability",
    "swiftness",
    "vigor",
  ]);
  const extension = Math.max(0, Number(event.duration || 0));
  const excluded = String(event.excludedKind || "");
  if (!(extension > 0)) return;
  for (const [kind, applications] of context.boons) {
    if (!boons.has(kind) || kind === excluded) continue;
    for (const application of applications) {
      if (
        application.affectsSelf !== false &&
        application.at <= event.at &&
        application.expiresAt > event.at
      ) {
        (application as { expiresAt: number }).expiresAt += extension;
      }
    }
  }
}

export const soulbeastEventHandlers = Object.freeze({
  "ranger.beastmode": handleSoulbeastModeEvent,
  "ranger.boon-extension": handleRangerBoonExtension,
});

export function activeSoulbeastBuff(
  context: RangerResolverContext,
  kind: string,
  at: number,
): boolean {
  return (context.boons.get(kind) || []).some(
    (application: Gw2TimedBuffApplication) =>
      application.at <= at &&
      application.expiresAt > at &&
      application.stacks > 0,
  );
}

export function queueSoulbeastBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  name: string,
  sourceId: number,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name,
    kind,
    duration,
    stacks,
    triggeredBy: event.skillName,
  });
}
