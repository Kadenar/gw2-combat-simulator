import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type { SchedulerState } from "../../../platform/engine/types.js";
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerClone,
  MesmerCloneAttackScheduler,
  MesmerDestroyClone,
  MesmerPendingResource,
  MesmerRuntimeState,
  MesmerResourceCause,
  MesmerResourceController,
  MesmerResourceDefinition,
  MesmerRuntime,
} from "../types.js";

// Names (not ids) — matched against proc `reason` strings via startsWith below.
const RESOURCE_TRAIT_IDS = new Set<number>([
  TRAIT.BLOODSONG,
  TRAIT.DECEPTIVE_EVASION,
  TRAIT.FORTISSIMO,
  TRAIT.HARMONIZE,
  TRAIT.ILLUSIONARY_REVERSION,
  TRAIT.INFINITE_FORGE,
  TRAIT.SELF_DECEPTION,
]);

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
  readonly scheduleResourceTask?:
    ((candidate: MesmerPendingResource) => unknown) | null;
  readonly balanceProfile: MesmerRuntime["balanceProfile"];
}

/**
 * Owns clone/blade/note gains and their typed-task reactions.
 */
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
  balanceProfile,
}: ResourceControllerOptions): MesmerResourceController {
  let cloneSequence = 0;
  const numericResourceState = () => {
    const active = state.profession.specialization;
    if (active.kind !== "Virtuoso" && active.kind !== "Troubadour") {
      throw new TypeError(
        `${active.kind} does not own a numeric Mesmer resource.`,
      );
    }
    return active.state;
  };
  let onAmbushCreatedClones = (
    _at: number,
    _clones: readonly MesmerClone[],
  ): void => {};

  const markCompounding = (at: number, count: number) => {
    const duration = Number(
      balanceProfile(TRAIT.COMPOUNDING_POWER)?.durationMultiplier || 8,
    );
    for (let index = 0; index < count; index += 1) {
      addEvent({
        type: "buff",
        at: at + index * epsilon,
        kind: "compounding",
        stacks: 1,
        duration,
      });
    }
  };

  const gainResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason = "",
    cause: MesmerResourceCause = {},
  ): void => {
    const amount = Math.max(0, Number(count || 0));
    if (!amount) return;
    let gained = 0;
    const created: Array<{ id: number; weapon: string }> = [];
    const createdClones: MesmerClone[] = [];

    if (resourceDefinition.singular === "clone") {
      for (let index = 0; index < amount; index += 1) {
        if (
          professionCoreState(state).clones.length >= resourceDefinition.maximum
        ) {
          const replaced = professionCoreState(state).clones.shift();
          if (replaced) destroyClone(replaced, at);
        }
        const clone = {
          id: ++cloneSequence,
          createdAt: at + index * epsilon,
          weapon: weapon || activePrimaryWeapon(),
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
      resourceState.numericResource = clamp(
        before + amount,
        0,
        resourceDefinition.maximum,
      );
      gained = resourceState.numericResource - before;
    }

    if (gained <= 0) return;
    addEvent({
      type: "resource",
      at,
      amount: gained,
      value:
        resourceDefinition.singular === "clone"
          ? professionCoreState(state).clones.length
          : numericResourceState().numericResource,
      resource: resourceDefinition.plural,
      reason,
      created,
    });
    if (traits.has(TRAIT.COMPOUNDING_POWER) && cause.kind !== "initial") {
      markCompounding(at, gained);
      addTraitProc(
        "Compounding Power",
        at,
        reason,
        `${gained} stack${gained === 1 ? "" : "s"}`,
      );
    }
    const resourceTraitId = Number(cause.traitId);
    if (
      RESOURCE_TRAIT_IDS.has(resourceTraitId) &&
      traits.has(resourceTraitId)
    ) {
      addTraitProc(
        cause.traitName || reason,
        at,
        reason,
        `+${gained} ${resourceDefinition.singular}`,
      );
    }
    if (
      (resourceTraitId === TRAIT.DECEPTIVE_EVASION ||
        (resourceTraitId === TRAIT.SELF_DECEPTION &&
          cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH)) &&
      traits.has(TRAIT.INFINITE_HORIZON) &&
      state.profession.specialization.kind === "Mirage" &&
      state.profession.specialization.state.cloneAmbushUntil >= at - epsilon
    ) {
      onAmbushCreatedClones(at, createdClones);
    }
  };

  const queueResources = (
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason: string,
    cause: MesmerResourceCause = {},
  ) => {
    if (scheduleResourceTask) {
      scheduleResourceTask({ at, count, weapon, reason, cause });
      return;
    }
    professionCoreState(state).pendingResources.push({
      at,
      count,
      weapon,
      reason,
      cause,
    });
    professionCoreState(state).pendingResources.sort((a, b) => a.at - b.at);
  };

  return {
    gainResources,
    markCompounding,
    queueResources,
    setAmbushCreatedClones(
      handler: (at: number, clones: readonly MesmerClone[]) => void,
    ) {
      onAmbushCreatedClones = handler;
    },
  };
}
