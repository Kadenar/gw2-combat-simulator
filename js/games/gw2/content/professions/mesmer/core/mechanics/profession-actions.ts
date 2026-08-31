import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/**
 * Handles shared profession actions decorated by active modules.
 * Manages resource consumption, trait procs (Maim/Phantom Pain/Illusionary Membrane/etc.).
 * Returns: consumeResources, currentResource, handleShatter, triggerShatterTraits.
 * @param {Object} config - Scheduler config (state, traits, resourceDefinition, etc.)
 * @returns {Object} Profession action controller
 */
import { mesmerNumericResourceState } from '#gw2/content/professions/mesmer/state/resources.js';
import { triggerMesmerPostShatterTraits } from '#gw2/content/professions/mesmer/core/traits/index.js';
import type { SchedulerState } from '#gw2/platform/engine/types.js';
import type {
  MesmerAddCondition,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerCastContext,
  MesmerDestroyClone,
  MesmerProfessionActionController,
  MesmerRuntimeState,
  MesmerResourceDefinition,
  MesmerRuntime,
  MesmerResourceSpendDetails,
  MesmerShatter,
  MesmerShatterResolver,
  MesmerShatterResolution,
  MesmerSkill
} from '#gw2/content/professions/mesmer/types.js';

interface ProfessionActionControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly destroyClone: MesmerDestroyClone;
  readonly epsilon: number;
  readonly shatters: Readonly<Record<number, MesmerShatter>>;
  readonly warnings: string[];
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly shatterResolvers: Readonly<Record<string, MesmerShatterResolver>>;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

export function createProfessionActionController({
  state,
  traits,
  resourceDefinition,
  destroyClone,
  epsilon,
  shatters,
  warnings,
  addEvent,
  addTraitProc,
  addCondition,
  shatterResolvers,
  balanceProfile
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
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    addEvent({
      type: 'resource',
      at,
      amount: -spent,
      value: currentResource(),
      resource: resourceDefinition.plural,
      reason: 'profession mechanic',
      ...(sourceSkill ? { sourceSkill } : {}),
      ...(Number.isInteger(rotationIndex) ? { rotationIndex } : {})
    });
    return spent;
  };

  // Clone path calls destroyClone per clone so the engine can emit death events; numeric path zeroes the counter.
  const consumeResources = (
    at: number,
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    const spent = currentResource();
    if (resourceDefinition.singular === 'clone') {
      for (const clone of professionCoreState(state).clones) {
        destroyClone(clone, at);
      }

      professionCoreState(state).clones = [];
    } else {
      numericResourceState().numericResource = 0;
    }

    return addResourceSpendEvent(at, spent, { sourceSkill, rotationIndex });
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
    { sourceSkill = '', rotationIndex = null }: MesmerResourceSpendDetails = {}
  ): number => {
    const reservedCount = Math.min(resourceDefinition.maximum, Math.max(0, Number(reserved || 0)));
    const additionalSpent = Math.min(
      numericResourceState().numericResource,
      resourceDefinition.maximum - reservedCount
    );
    numericResourceState().numericResource -= additionalSpent;
    return addResourceSpendEvent(at, reservedCount + additionalSpent, {
      sourceSkill,
      rotationIndex
    });
  };

  const restoreReservedResources = (spent: number): void => {
    if (resourceDefinition.singular === 'clone') return;
    numericResourceState().numericResource = Math.min(
      resourceDefinition.maximum,
      numericResourceState().numericResource + Math.max(0, Number(spent || 0))
    );
  };

  // Shared traits consume resolver-produced hit groups so Core does not need to know how a specialization attacks.
  const triggerShatterTraits = (resolution: MesmerShatterResolution): void => {
    triggerMesmerPostShatterTraits(
      { traits, addEvent, addTraitProc, addCondition, balanceProfile },
      shatters[resolution.skill.id],
      resolution,
      epsilon
    );
  };

  // Orchestrates resource spending and shared traits while the registered resolver owns packet behavior.
  // resourcesSpent=null means consume resources now; a pre-computed value skips the consume.
  const handleShatter = (
    context: MesmerCastContext,
    skill: MesmerSkill,
    at: number,
    resourcesSpent: number | null = null,
    castStart = at
  ): MesmerShatterResolution | null => {
    const shatter = shatters[skill.id];
    if (!shatter) {
      throw new Error(`Missing Mesmer shatter data for ${skill.name}.`);
    }

    const minimumResource = Number(shatter.minimumResource || 0);
    if (resourcesSpent == null && currentResource() < minimumResource) {
      warnings.push(`${skill.name} skipped at ${at.toFixed(2)}s: no ${resourceDefinition.plural}.`);
      return null;
    }

    const resolver = shatterResolvers[shatter.resolver];
    if (!resolver) {
      throw new Error(`Missing Mesmer shatter resolver ${shatter.resolver} for ${skill.name}.`);
    }

    const spent = resourcesSpent ?? consumeResources(at);
    const resolution: MesmerShatterResolution = {
      skill,
      at,
      spent,
      traitHits: resolver(context, {
        skill,
        shatter,
        at,
        castStart,
        spent
      })
    };
    triggerShatterTraits(resolution);
    addEvent({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${spent} ${resourceDefinition.plural} spent`
    });
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
