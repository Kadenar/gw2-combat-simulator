import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { legacyComboBindingForOwner } from "../../../../platform/gw2/legacy-combo-adapter.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
} from "../../types.js";

const ASSUMED_FIELD_EXPIRES_AT = 1_000_000_000;

/** Emits the explicit field selected by the Reaper permanent-field assumption. */
export function iceFieldComboFinishers(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  if (
    !context.config.professionAssumptions?.permanentIceField ||
    context.events.some(
      (candidate) =>
        candidate.type === "combo_field" &&
        candidate.fieldId === "necromancer:assumption:permanent-ice-field",
    )
  ) {
    return;
  }
  context.emitDerived(event, {
    type: "combo_field",
    at: event.at,
    source: "Permanent Ice Field assumption",
    sourceId: "necromancer.assumption.permanent-ice-field",
    actorType: "effect",
    skillName: "Permanent Ice Field assumption",
    fieldId: "necromancer:assumption:permanent-ice-field",
    fieldType: "Ice",
    expiresAt: ASSUMED_FIELD_EXPIRES_AT,
    ownerId: "necromancer",
    ownerActorType: "player",
  });
}

/**
 * Summon attacks become finishers only after their resolver generation guards
 * pass, so dead or replaced minions cannot create authoritative combo effects.
 */
export function resolveSummonIceFieldComboFinisher(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "summon" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  const skill = context.helpers.skillsById?.get(
    event.skillId ?? event.sourceId,
  );
  const finisherType = String(event.finisherType || skill?.finisherType || "");
  const chance = Number(event.finisherValue ?? skill?.finisherValue ?? 0);
  if (finisherType.toLowerCase() !== "projectile" || !(chance > 0)) return;
  const binding = legacyComboBindingForOwner(
    context.combo,
    "necromancer",
    event.at,
  );
  if (!binding) return;
  enqueueOrdered(context.queue, {
    type: "combo_finisher",
    at: event.at,
    effectAt: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: event.actorType,
    skillId: event.skillId,
    skillName: event.skillName,
    parentSkillName: event.parentSkillName,
    activationId: event.activationId,
    attemptId: `${event.activationId || event.sourceId}:projectile:${event.__order || event.at}`,
    finisherType: "Projectile",
    fieldBinding: binding,
    chance,
    applications: 1,
    successfulCombos: 1,
  });
}
