// Warden's extra field bolts use stable attempt IDs; the skill definition owns its ordinary whirls.
import { comboCombatMetadata } from '#gw2/platform/combos/definitions.js';
import type { ComboFinisherEvent } from '#gw2/platform/combos/types.js';
import { COMBO_FINISHER } from '#gw2/platform/constants.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MesmerPhantasmExecution } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Inspect fields at each attack, after field registration and before the corresponding strike. */
export function scheduleWardenWhirl(
  runtime: MesmerRuntime,
  execution: MesmerPhantasmExecution,
  packet: SimulationEventBase,
  cycle: 'initial' | 'repeat'
): void {
  if (
    execution.skill.id !== ID.PHANTASMAL_WARDEN ||
    packet.type !== 'damage' ||
    !packet.comboFinishers?.some((finisher) => finisher.finisherType === COMBO_FINISHER.WHIRL)
  )
    return;

  runtime.effects.emit({
    ...execution.delivery,
    kind: 'packet',
    event: {
      ...comboCombatMetadata(packet),
      type: 'mesmer.warden-whirl',
      at: packet.at + (execution.delivery.cast?.impactDelayMs ?? 0) / 1000,
      priority: -0.75,
      source: packet.source,
      sourceId: packet.sourceId,
      actorType: packet.actorType,
      skillId: packet.skillId,
      skillName: packet.skillName,
      // The cycle identity separates overlapping casts, co-summoned entities, and Chronophantasma repeats.
      attemptId: JSON.stringify([
        execution.delivery.cast?.activationId,
        execution.summonAt,
        execution.entityIndex,
        cycle
      ])
    }
  });
}

/** Reuse each field's attempt ID across pulses so only its first extra bolt resolves per summon cycle. */
export function resolveWardenWhirl(runtime: MesmerRuntime, event: Gw2ResolverEvent): void {
  if (runtime.deathTime != null) return;

  const fields = runtime.combat.activeComboFields('mesmer', event.at);
  for (const field of fields) {
    const finisher: ComboFinisherEvent = {
      ...comboCombatMetadata(event),
      type: 'combo_finisher',
      at: event.at,
      effectAt: event.at,
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      skillId: event.skillId,
      skillName: event.skillName,
      attemptId: `${event.attemptId}:field:${field.fieldId}`,
      fieldId: field.fieldId,
      finisherType: COMBO_FINISHER.WHIRL,
      chance: 1,
      applications: 1,
      successfulCombos: 1
    };
    runtime.effects.emit({ kind: 'packet', cause: event, event: finisher });
  }
}
