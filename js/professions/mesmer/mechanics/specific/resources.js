import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";

// Names (not ids) — matched against proc `reason` strings via startsWith below.
const RESOURCE_TRAIT_IDS = new Set([
  TRAIT.BLOODSONG,
  TRAIT.DECEPTIVE_EVASION,
  TRAIT.FORTISSIMO,
  TRAIT.ILLUSIONARY_REVERSION,
  TRAIT.INFINITE_FORGE,
  TRAIT.SELF_DECEPTION,
]);

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
}) {
  let cloneSequence = 0;
  let onAmbushCreatedClones = () => {};

  const markCompounding = (at, count) => {
    for (let index = 0; index < count; index += 1) {
      addEvent({
        type: "buff",
        at: at + index * epsilon,
        kind: "compounding",
        stacks: 1,
        duration: 8,
      });
    }
  };

  const gainResources = (
    at,
    count,
    weapon,
    reason = "",
    cause = {},
  ) => {
    const amount = Math.max(0, Number(count || 0));
    if (!amount) return;
    let gained = 0;
    const created = [];
    const createdClones = [];

    if (resourceDefinition.singular === "clone") {
      for (let index = 0; index < amount; index += 1) {
        if (state.profession.clones.length >= resourceDefinition.maximum) {
          const replaced = state.profession.clones.shift();
          destroyClone(replaced, at);
        }
        const clone = {
          id: ++cloneSequence,
          createdAt: at + index * epsilon,
          weapon: weapon || activePrimaryWeapon(),
        };
        const initialized = cloneAttackScheduler.initializeClone(clone);
        state.profession.clones.push(initialized);
        createdClones.push(initialized);
        created.push({ id: clone.id, weapon: clone.weapon });
        gained += 1;
      }
    } else {
      const before = state.profession.numericResource;
      state.profession.numericResource = clamp(
        before + amount,
        0,
        resourceDefinition.maximum,
      );
      gained = state.profession.numericResource - before;
    }

    if (gained <= 0) return;
    addEvent({
      type: "resource",
      at,
      amount: gained,
      value:
        resourceDefinition.singular === "clone"
          ? state.profession.clones.length
          : state.profession.numericResource,
      resource: resourceDefinition.plural,
      reason,
      created,
    });
    if (
      traits.has(TRAIT.COMPOUNDING_POWER) &&
      cause.kind !== "initial"
    ) {
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
      state.profession.cloneAmbushUntil >= at - epsilon
    ) {
      onAmbushCreatedClones(at, createdClones);
    }
  };

  const queueResources = (at, count, weapon, reason, cause = {}) => {
    if (scheduleResourceTask) {
      scheduleResourceTask({ at, count, weapon, reason, cause });
      return;
    }
    state.profession.pendingResources.push({
      at,
      count,
      weapon,
      reason,
      cause,
    });
    state.profession.pendingResources.sort((a, b) => a.at - b.at);
  };

  return {
    gainResources,
    markCompounding,
    queueResources,
    setAmbushCreatedClones(handler) {
      onAmbushCreatedClones = handler;
    },
  };
}
