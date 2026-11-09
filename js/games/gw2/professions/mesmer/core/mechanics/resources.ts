import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { createMesmerClones } from '#gw2/professions/mesmer/core/mechanics/illusions/clones.js';
import type {
  MesmerClone,
  MesmerIllusionRewards,
  MesmerResourceGain
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type {
  MesmerPendingResource,
  MesmerResourceCause,
  MesmerResourceDefinition
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerActivePrimaryWeapon, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

interface IllusionRewardOptions {
  readonly state: MesmerRuntime;
  /** The family binding always owns delivery of committed gains to the selected specialization. */
  readonly onGain: (gain: MesmerResourceGain) => void;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly scheduleResourceTask: (candidate: MesmerPendingResource, delivery?: EffectDelivery) => unknown;
}

/** Creates clones, grants earned numeric rewards, and reports committed gains to active specialization reactions. */
export function createIllusionRewardController({
  state,
  resourceDefinition,
  activePrimaryWeapon,
  scheduleResourceTask,
  onGain
}: IllusionRewardOptions): MesmerIllusionRewards {
  const kind = mesmerResourceKind(state.profession.specialization.kind);

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
    let createdClones: MesmerClone[] = [];

    if (kind === 'clones') {
      createdClones = createMesmerClones(state, {
        at,
        count: amount,
        weapon: weapon || activePrimaryWeapon(),
        maximum: resourceDefinition.maximum
      });
      gained = createdClones.length;
    } else {
      // Only the actual capped gain earns Compounding Power and specialization rewards.
      const before = state.resourceController.value(kind);
      state.resourceController.grant(kind, amount);
      gained = state.resourceController.value(kind) - before;
    }

    if (gained <= 0) return;

    {
      const packet = buildMesmerPacket({
        type: 'resource',
        at,
        amount: gained,
        value:
          kind === 'clones'
            ? professionCoreState(state.profession).clones.length
            : state.resourceController.value(kind),
        resource: resourceDefinition.plural,
        ...(kind !== 'clones' ? { maximum: resourceDefinition.maximum } : {}),
        reason,
        created: createdClones.map(({ id, weapon }) => ({ id, weapon }))
      });
      state.effects.emit({
        kind: 'packet',
        event: packet
      });
    }

    if (cause.kind !== 'initial') {
      state.fireTrigger(mesmerIllusionsGained, {
        at,
        count: gained,
        sourceSkill: reason,
        detail: `${gained} stack${gained === 1 ? '' : 's'}`
      });
    }

    const resourceTraitId = Number(cause.traitId);

    if (Number.isFinite(resourceTraitId) && hasTrait(state, resourceTraitId)) {
      state.effects.emit({
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: resourceTraitId, actorType: ACTOR.EFFECT },
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
    onGain({ at, cause, createdClones });
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
    gainResources,
    queueResources
  };
}

/** Only actual capped resource gains and committed phantasm summons grant Compounding Power stacks. */
export const mesmerIllusionsGained = defineTriggerPoint<{
  readonly at: number;
  readonly count: number;
  readonly sourceSkill: string;
  readonly detail: string;
  readonly delivery?: EffectDelivery;
}>('mesmer.illusions-gained', [TRAIT.COMPOUNDING_POWER]);
