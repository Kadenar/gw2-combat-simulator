import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type { Gw2ResolverEvent } from "../../../../platform/gw2/types.js";
import type { ElementalistResolverContext } from "../../types.js";
import {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs,
} from "../../core/resolver.js";

export function applyTempestResolverAura(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
): void {
  if (!hasTrait(context, "Tempestuous Aria")) return;
  const current = activeElementalistBuffs(
    context,
    "Tempestuous Aria",
    event.at,
  ).at(-1);
  if (current) {
    refreshElementalistBuffs(
      context,
      "Tempestuous Aria",
      event.at,
      (expiresAt) =>
        expiresAt === current.expiresAt
          ? Math.min(event.at + 10, expiresAt + 5)
          : expiresAt,
    );
  } else {
    queueElementalistBuff(
      context,
      event,
      "Tempestuous Aria",
      1,
      5,
      elementalistSourceSkill(event),
    );
  }
  recordElementalistTraitProc(context, event, "Tempestuous Aria");
}
