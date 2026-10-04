import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  MesmerClone,
  MesmerCloneAttackScheduler,
  MesmerDestroyClone,
  MesmerResourceController
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type {
  MesmerPendingResource,
  MesmerResourceCause,
  MesmerResourceDefinition
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { triggerCompoundingPower } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { mesmerNumericResourceState } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerActivePrimaryWeapon, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

interface ResourceControllerOptions {
  readonly state: MesmerRuntime;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly clamp: (value: number, minimum: number, maximum: number) => number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly cloneAttackScheduler: MesmerCloneAttackScheduler;
  readonly destroyClone: MesmerDestroyClone;
  readonly scheduleResourceTask: (candidate: MesmerPendingResource, delivery?: EffectDelivery) => unknown;
}

/** Owns shared clone or numeric resource gains and exposes committed gains to active specialization reactions. */
export function createResourceController({
  state,
  resourceDefinition,
  clamp,
  activePrimaryWeapon,
  cloneAttackScheduler,
  destroyClone,
  scheduleResourceTask
}: ResourceControllerOptions): MesmerResourceController {
  let cloneSequence = 0;
  const gainHandlers: Array<Parameters<MesmerResourceController['addGainHandler']>[0]> = [];
  const numericResourceState = () => mesmerNumericResourceState(state);

  const gainResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason = '',
    cause: MesmerResourceCause = {}
  ): void => {
    const amount = Math.max(0, count || 0);
    if (!amount || resourceDefinition.maximum <= 0) return;
    let gained = 0;
    const created: Array<{ id: number; weapon: string }> = [];
    const createdClones: MesmerClone[] = [];

    if (resourceDefinition.singular === 'clone') {
      for (let index = 0; index < amount; index += 1) {
        if (professionCoreState(state).clones.length >= resourceDefinition.maximum) {
          const replaced = professionCoreState(state).clones.shift();
          if (replaced) destroyClone(replaced);
        }

        const clone = {
          id: ++cloneSequence,
          // Clone IDs provide stable identity; simultaneous gains share the resource task's timestamp.
          createdAt: at,
          weapon: weapon || activePrimaryWeapon()
        };
        const initialized = cloneAttackScheduler.initializeClone(clone);
        professionCoreState(state).clones.push(initialized);
        createdClones.push(initialized);
        created.push({ id: clone.id, weapon: clone.weapon });
        gained += 1;
      }
    } else {
      const resourceState = numericResourceState();
      const before = resourceState.numericResource;
      resourceState.numericResource = clamp(before + amount, 0, resourceDefinition.maximum);
      gained = resourceState.numericResource - before;
    }

    if (gained <= 0) return;
    {
      const packet = buildMesmerPacket({
        type: 'resource',
        at,
        amount: gained,
        value:
          resourceDefinition.singular === 'clone'
            ? professionCoreState(state).clones.length
            : numericResourceState().numericResource,
        resource: resourceDefinition.plural,
        reason,
        created
      });
      state.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    if (cause.kind !== 'initial') {
      triggerCompoundingPower(state, at, gained, reason, `${gained} stack${gained === 1 ? '' : 's'}`);
    }

    const resourceTraitId = Number(cause.traitId);
    if (Number.isFinite(resourceTraitId) && hasTrait(state, resourceTraitId)) {
      state.effects.emit({
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: resourceTraitId, actorType: 'effect' },
        announcement: {
          type: 'trait',
          name: cause.traitName || reason,
          at: at,
          sourceSkill: reason,
          detail: `+${gained} ${resourceDefinition.singular}`
        }
      });
    }

    // Reactions use the committed gain's time, cause, and created clones to apply specialization effects.
    for (const handler of gainHandlers) handler({ at, cause, createdClones });
  };

  const queueResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason: string,
    cause: MesmerResourceCause = {},
    delivery: EffectDelivery = {}
  ): void => {
    scheduleResourceTask({ at, count, weapon, reason, cause }, delivery);
  };

  return {
    addGainHandler(handler) {
      gainHandlers.push(handler);
    },
    gainResources,
    queueResources
  };
}
