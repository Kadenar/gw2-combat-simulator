import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueGw2OwnedComboFinisher } from "../../../platform/gw2/resolver/combo-resolution.js";
import { applyCondition, queueBuff, queueDamage } from "./shared.js";
import { snapshotEngineerState } from "./state.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSkill,
} from "../types.js";

// state snapshot is embedded in the event so the resolver can apply it without re-reading scheduler memory
export function emitEngineerState(
  context: EngineerSchedulerContext,
  at: number,
  reason: string,
): void {
  context.emit({
    type: "engineer.state",
    at,
    source: "engineer",
    sourceId: `engineer.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotEngineerState(context.state.profession),
  });
}

// kit equip/stow is treated as a weapon bar swap by the sigil system — must emit sigil_swap (not a custom type)
export function emitEngineerBarSwap(
  context: EngineerSchedulerContext,
  skill: EngineerSkill,
  at: number,
): void {
  context.emit({
    type: "sigil_swap",
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
}

export function handleEngineerState(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  // traitProcReadyAt advances independently in the resolver; restoring it from the snapshot would
  // roll back already-consumed trait proc windows and allow double-triggering
  const preserved = {
    traitProcReadyAt: core.traitProcReadyAt || {},
  };
  for (const [key, value] of Object.entries(event.state || {})) {
    // some keys live in specialization state (e.g. holosmith heat), others in core — route without a lookup table
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    (owner as SchedulerRecord)[key] = structuredClone(value);
  }
  Object.assign(core, preserved);
}

// "Focused" is an amalgam buff state; when active it boosts certain skill coefficients
function focused(context: EngineerResolverContext, at: number): boolean {
  return Number(professionCoreState(context).focusedUntil || 0) > at;
}

export function handleLightningRodPulse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const isFocused = focused(context, event.at);
  queueDamage(context, event, {
    name: "Lightning Rod",
    coefficient: isFocused ? 0.3 : 0.17,
  });
  // Immobilize only on the second hit (hitIndex 1, 0-based) — not every pulse
  if (event.hitIndex === 1) {
    applyCondition({}, context, event, {
      name: "Lightning Rod",
      condition: "Immobilized",
      stacks: 1,
      duration: 2,
    });
  }
}

export function handleConduitSurge(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  // Math.max preserves a longer existing Focused window; Conduit Surge must not shorten it
  professionCoreState(context).focusedUntil = Math.max(
    Number(professionCoreState(context).focusedUntil || 0),
    event.at + 10,
  );
  queueDamage(context, event, {
    name: "Conduit Surge",
    coefficient: 1.2,
  });
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    name: "Conduit Surge — Burning",
    skillName: "Conduit Surge",
    condition: "Burning",
    stacks: 1,
    duration: 7,
    source: "engineer",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "player",
  });
}

export function handleElectricArtillery(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const isFocused = focused(context, event.at);
  // charges accumulate from Lightning Rod hits (max 12); Math.trunc discards partial charges
  const charges = Math.max(
    0,
    Math.min(12, Math.trunc(Number(event.charges || 0))),
  );
  queueDamage(context, event, {
    name: "Electric Artillery",
    coefficient: isFocused ? 1.5 : 1,
    explosion: true,
  });
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    name: "Electric Artillery — Burning",
    skillName: "Electric Artillery",
    condition: "Burning",
    stacks: 2,
    duration: 3 + charges * (isFocused ? 0.5 : 0.25),
    source: "engineer",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "player",
  });
}

export function handleRadiantArcQuickness(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  // duration is computed by the scheduler (trait-modified); ?? 2 is the unmodified base fallback
  queueBuff(context, event, {
    name: "Radiant Arc — quickness",
    kind: "quickness",
    stacks: 1,
    duration: Math.max(0, Number(event.duration ?? 2)),
  });
}

export function handleRefractionCutterExtraBlades(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const extraBlades = Math.max(0, Math.trunc(Number(event.extraBlades || 0)));
  for (let blade = 0; blade < extraBlades; blade += 1) {
    // 0.36s offset matches in-game animation timing between sequential blade projectiles
    const at = event.at + 0.36;
    // hitIndex starts at 2 because the base hit (index 1) is handled by the parent skill event
    const damage = enqueueOrdered(context.queue, {
      type: "damage",
      at,
      name: "Refraction Cutter Blade",
      skillName: event.skillName,
      coefficient: 0.4,
      hits: 1,
      hitIndex: blade + 2,
      totalHits: extraBlades + 1,
      source: "engineer",
      sourceId: event.skillId ?? event.sourceId,
      actorType: "player",
      skillId: event.skillId,
      skillWeapon: "Sword",
      projectile: true,
      comboFinishers: [
        {
          ownerId: "engineer",
          finisherType: "Projectile",
          chance: 0.2,
          preferredFieldTypes: ["Fire"],
          ambiguousFieldSelection: "oldest",
        },
      ],
    });
    // enqueueGw2OwnedComboFinisher triggers actual combo field resolution; the comboFinishers array
    // above is only a declaration for display/analysis — both are required
    enqueueGw2OwnedComboFinisher(context, damage, {
      ownerId: "engineer",
      attemptId: `${event.activationId || event.sourceId}:refraction-cutter:projectile:${blade + 2}`,
      finisherType: "Projectile",
      at,
      effectAt: at,
      chance: 0.2,
      preferredFieldTypes: ["Fire"],
      ambiguousFieldSelection: "oldest",
    });
    enqueueOrdered(context.queue, {
      type: "condition",
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: "Bleeding",
      stacks: 1,
      duration: 4,
      applicationIndex: blade + 2,
      totalApplications: extraBlades + 1,
      source: "engineer",
      sourceId: event.skillId ?? event.sourceId,
      actorType: "player",
      skillId: event.skillId,
    });
  }
}
