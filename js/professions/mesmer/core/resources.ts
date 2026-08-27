import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { SchedulerState } from '../../../platform/engine/types.js';
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerClone,
  MesmerCloneAttackScheduler,
  MesmerDestroyClone,
  MesmerPendingResource,
  MesmerResourceCause,
  MesmerResourceController,
  MesmerResourceDefinition,
  MesmerRuntime,
  MesmerRuntimeState
} from '../types.js';

interface ResourceControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly epsilon: number;
  readonly clamp: (value: number, minimum: number, maximum: number) => number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly cloneAttackScheduler: MesmerCloneAttackScheduler;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly destroyClone: MesmerDestroyClone;
  readonly scheduleResourceTask?: ((candidate: MesmerPendingResource) => unknown) | null;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

/** Owns shared clone or numeric resource gains and exposes committed gains to active specialization reactions. */
export function createResourceController({
  state,
  traits,
  resourceDefinition,
  epsilon,
  clamp,
  activePrimaryWeapon,
  cloneAttackScheduler,
  addEvent,
  addTraitProc,
  destroyClone,
  scheduleResourceTask = null,
  balanceProfile
}: ResourceControllerOptions): MesmerResourceController {
  let cloneSequence = 0;
  const gainHandlers: Array<Parameters<MesmerResourceController['addGainHandler']>[0]> = [];
  const numericResourceState = () => {
    const active = state.profession.specialization.state as Partial<{ numericResource: number }>;
    if (typeof active.numericResource !== 'number') {
      throw new TypeError(`${state.profession.specialization.kind} does not own a numeric Mesmer resource.`);
    }

    return active as { numericResource: number };
  };

  const markCompounding = (at: number, count: number): void => {
    const duration = Number(balanceProfile(TRAIT.COMPOUNDING_POWER)?.durationMultiplier || 8);
    for (let index = 0; index < count; index += 1) {
      addEvent({
        type: 'buff',
        at: at + index * epsilon,
        kind: 'compounding',
        stacks: 1,
        duration
      });
    }
  };

  const gainResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason = '',
    cause: MesmerResourceCause = {}
  ): void => {
    const amount = Math.max(0, Number(count || 0));
    if (!amount) return;
    let gained = 0;
    const created: Array<{ id: number; weapon: string }> = [];
    const createdClones: MesmerClone[] = [];

    if (resourceDefinition.singular === 'clone') {
      for (let index = 0; index < amount; index += 1) {
        if (professionCoreState(state).clones.length >= resourceDefinition.maximum) {
          const replaced = professionCoreState(state).clones.shift();
          if (replaced) destroyClone(replaced, at);
        }

        const clone = {
          id: ++cloneSequence,
          createdAt: at + index * epsilon,
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
    addEvent({
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
    if (traits.has(TRAIT.COMPOUNDING_POWER) && cause.kind !== 'initial') {
      markCompounding(at, gained);
      addTraitProc('Compounding Power', at, reason, `${gained} stack${gained === 1 ? '' : 's'}`);
    }

    const resourceTraitId = Number(cause.traitId);
    if (Number.isFinite(resourceTraitId) && traits.has(resourceTraitId)) {
      addTraitProc(cause.traitName || reason, at, reason, `+${gained} ${resourceDefinition.singular}`);
    }

    // Reactions see only committed gains, including the exact clone entities created by this transaction.
    for (const handler of gainHandlers) handler({ at, gained, reason, cause, createdClones });
  };

  const queueResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason: string,
    cause: MesmerResourceCause = {}
  ): void => {
    if (scheduleResourceTask) {
      scheduleResourceTask({ at, count, weapon, reason, cause });
      return;
    }

    professionCoreState(state).pendingResources.push({ at, count, weapon, reason, cause });
    professionCoreState(state).pendingResources.sort((left, right) => left.at - right.at);
  };

  return {
    addGainHandler(handler) {
      gainHandlers.push(handler);
    },
    gainResources,
    markCompounding,
    queueResources
  };
}
