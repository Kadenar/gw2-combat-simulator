/**
 * Resolver-only Mesmer trait mechanics whose trigger does not affect later
 * scheduler-owned state.
 */

import {
  isInternalCooldownReady,
} from "../../../../platform/engine/internal-cooldown.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

/**
 * Triggers Ineptitude on control/blind events.
 */
export function triggerIneptitude(
  ctx,
  event,
  detail,
  applyCondition,
) {
  if (!ctx.traits.has(TRAIT.INEPTITUDE)) return;
  const defiant = Boolean(ctx.config.target?.defiant);
  if (
    defiant
    && !isInternalCooldownReady(
      event.at,
      ctx.profession.ineptitudeReadyAt,
    )
  ) return;
  if (defiant) ctx.profession.ineptitudeReadyAt = event.at + 3;
  const count = defiant
    ? 1
    : Math.max(1, Math.trunc(Number(event.count || 1)));
  ctx.recordProc(
    "trait",
    "Ineptitude",
    event.at,
    event.skillName,
    count > 1 ? `${detail}, ${count} strikes` : detail,
  );
  applyCondition(ctx, {
    type: "condition",
    at: event.at,
    name: `${event.skillName} — Ineptitude`,
    skillName: event.skillName,
    condition: "Confusion",
    duration: 5,
    stacks: 2 * count,
    source: "Player",
  });
}
