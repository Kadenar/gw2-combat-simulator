import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
/**
 * Handles shared profession actions decorated by active modules.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleShatter, triggerShatterTraits.
 * Profession action controller
 */
import type { MesmerDestroyClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type {
  MesmerResourceDefinition,
  MesmerResourceSpendDetails
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerShatter, MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { triggerMesmerPostShatterTraits } from '#gw2/professions/mesmer/core/traits/dispatch.js';
import { mesmerNumericResourceState } from '#gw2/professions/mesmer/family-state.js';
import type {
  MesmerProfessionActionController,
  MesmerRuntime,
  MesmerShatterResolver
} from '#gw2/professions/mesmer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

interface ProfessionActionControllerOptions {
  readonly state: MesmerRuntime;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly destroyClone: MesmerDestroyClone;
  readonly shatterFor: (id: SkillId) => MesmerShatter | undefined;
  readonly warn: (message: string) => void;
  readonly shatterResolvers: Readonly<Record<string, MesmerShatterResolver>>;
}

export function createProfessionActionController({
  state,
  resourceDefinition,
  destroyClone,
  shatterFor,
  warn,
  shatterResolvers
}: ProfessionActionControllerOptions): MesmerProfessionActionController {
  const numericResourceState = () => mesmerNumericResourceState(state);

  // Clone-based specs (core/Chronomancer) count live clones; numeric specs (Virtuoso/Troubadour) use a counter.
  const currentResource = () =>
    resourceDefinition.singular === 'clone'
      ? professionCoreState(state).clones.length
      : numericResourceState().numericResource;

  const addResourceSpendEvent = (
    at: number,
    spent: number,
    { activationId }: MesmerResourceSpendDetails = {}
  ): number => {
    {
      const packet = buildMesmerPacket({
        type: 'resource',
        at,
        amount: -spent,
        value: currentResource(),
        resource: resourceDefinition.plural,
        reason: 'profession mechanic',
        activationId
      });
      state.effects.emit({
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    return spent;
  };

  // Spending clones cancels their pending attacks; numeric resources only need their counter cleared.
  const consumeResources = (at: number, { activationId }: MesmerResourceSpendDetails = {}): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === 'clone') {
      for (const clone of professionCoreState(state).clones) {
        destroyClone(clone);
      }

      professionCoreState(state).clones = [];
    } else {
      numericResourceState().numericResource = 0;
    }

    return addResourceSpendEvent(at, spent, { activationId });
  };

  // Reserve/commit/restore supports skills that must read the count before the cast resolves damage
  // (e.g. a Virtuoso skill whose coefficient scales with blades but costs all blades on hit, not on cast).
  const reserveResources = (): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === 'clone') {
      throw new Error('Clone resources cannot be reserved.');
    }

    numericResourceState().numericResource = 0;
    return spent;
  };

  // Any blades gained between reserveResources and hit time are consumed here too, up to the cap.
  const commitReservedResources = (
    at: number,
    reserved: number,
    { activationId }: MesmerResourceSpendDetails = {}
  ): number => {
    const reservedCount = boundedNumber(reserved, 0, 0, resourceDefinition.maximum);
    const additionalSpent = Math.min(
      numericResourceState().numericResource,
      resourceDefinition.maximum - reservedCount
    );
    numericResourceState().numericResource -= additionalSpent;
    return addResourceSpendEvent(at, reservedCount + additionalSpent, {
      activationId
    });
  };

  const restoreReservedResources = (spent: number): void => {
    if (resourceDefinition.singular === 'clone') return;
    numericResourceState().numericResource = Math.min(
      resourceDefinition.maximum,
      numericResourceState().numericResource + Math.max(0, spent || 0)
    );
  };

  // Shared traits consume resolver-produced hit groups so Core does not need to know how a specialization attacks.
  const triggerShatterTraits = (resolution: MesmerShatterResolution): void => {
    triggerMesmerPostShatterTraits(state, shatterFor(resolution.skill.id), resolution);
  };

  // Orchestrates resource spending and shared traits while the registered resolver owns packet behavior.
  // resourcesSpent=null means consume resources now; a pre-computed value skips the consume.
  const handleShatter = (
    context: MesmerRuntime,
    skill: MesmerSkill,
    at: number,
    resourcesSpent: number | null = null,
    castStart = at,
    packetAt = at,
    delivery: EffectDelivery = {}
  ): MesmerShatterResolution | null => {
    const shatter = shatterFor(skill.id);
    if (!shatter) {
      throw new Error(`Missing Mesmer shatter data for ${skill.name}.`);
    }

    const minimumResource = shatter.minimumResource || 0;
    if (resourcesSpent == null && currentResource() < minimumResource) {
      // Preserve milliseconds so skipped actions can be located in the event log.
      warn(`${skill.name} skipped at ${at.toFixed(3)}s: no ${resourceDefinition.plural}.`);
      return null;
    }

    const resolver = shatterResolvers[shatter.resolver];
    if (!resolver) {
      throw new Error(`Missing Mesmer shatter resolver ${shatter.resolver} for ${skill.name}.`);
    }

    const spent = resourcesSpent ?? consumeResources(at);
    const resolution: MesmerShatterResolution = {
      delivery,
      skill,
      at,
      spent,
      traitHits: resolver(context, {
        delivery,
        skill,
        shatter,
        at: packetAt,
        castStart,
        spent
      })
    };
    // The resolved profile is already available for this transaction; share it with post-shatter traits.
    triggerMesmerPostShatterTraits(state, shatter, resolution);
    {
      const packet = buildMesmerPacket({
        type: 'marker',
        at,
        name: skill.name,
        detail: `${spent} ${resourceDefinition.plural} spent`
      });
      state.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    return resolution;
  };

  return {
    commitReservedResources,
    consumeResources,
    currentResource,
    handleShatter,
    reserveResources,
    restoreReservedResources,
    triggerShatterTraits
  };
}
