/**
 * Trait mechanics during resolution: critical trait procs (Sharper Images, Jagged Mind),
 * interrupt triggers (Ineptitude).
 */

import { EPSILON } from "../../../platform/engine/clock.js";

/**
 * Handles critical trait procs: Sharper Images (clone/phantasm crit → Bleeding),
 * Jagged Mind (blade attack crit chance → Bleeding stacks).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 * @param {Object} hitContext - Hit context with critical.chance
 * @param {Function} applyCondition - Condition application function
 */
export function handleCriticalTraits(
  ctx,
  event,
  hitContext,
  applyCondition,
) {
  if (
    ctx.traits.has("Sharper Images")
    && (event.source === "Clone" || event.source === "Phantasm")
  ) {
    ctx.profession.sharperImagesProgress += hitContext.critical.chance;
    const procCount = Math.floor(
      ctx.profession.sharperImagesProgress + EPSILON,
    );
    if (procCount > 0) {
      ctx.profession.sharperImagesProgress -= procCount;
      applyCondition(ctx, {
        type: "condition",
        at: event.at,
        name: `${event.name} — Sharper Images`,
        skillName: event.skillName,
        condition: "Bleeding",
        duration: 5,
        stacks: procCount,
        // Sharper Images is the Mesmer's trait proc, not a native illusion
        // condition. It uses the Mesmer's condition damage modifiers.
        source: "Player",
      });
      ctx.recordProc(
        "trait",
        "Sharper Images",
        event.at,
        event.skillName,
        `${procCount} critical-hit proc${procCount === 1 ? "" : "s"}`,
      );
    }
  }

  if (ctx.traits.has("Jagged Mind") && event.blade) {
    applyCondition(ctx, {
      type: "condition",
      at: event.at,
      name: `${event.name} — Jagged Mind`,
      skillName: event.skillName,
      condition: "Bleeding",
      duration: 4,
      stacks: hitContext.critical.chance,
      source: event.source,
    });
    ctx.recordProc("trait", "Jagged Mind", event.at, event.skillName);
  }
}

/**
 * Triggers Ineptitude on control/blind events: applies 2 Confusion stacks per strike (5s duration).
 * Defiant target: 1 stack, 3s cooldown; non-defiant: scales by strike count.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Control/blind event with count (optional)
 * @param {string} detail - Detail string for UI (e.g., "interrupt → blind → confusion")
 * @param {Function} applyCondition - Condition application function
 */
export function triggerIneptitude(
  ctx,
  event,
  detail,
  applyCondition,
) {
  if (!ctx.traits.has("Ineptitude")) return;
  const defiant = Boolean(ctx.config.target?.defiant);
  if (
    defiant
    && event.at < ctx.profession.ineptitudeReadyAt - EPSILON
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
