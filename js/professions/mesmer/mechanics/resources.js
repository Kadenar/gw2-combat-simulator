const RESOURCE_TRAITS = [
  "Bloodsong",
  "Deceptive Evasion",
  "Fortissimo",
  "Illusionary Reversion",
  "Infinite Forge",
  "Self-Deception",
];

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

  const gainResources = (at, count, weapon, reason = "") => {
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
    if (traits.has("Compounding Power") && reason !== "initial") {
      markCompounding(at, gained);
      addTraitProc(
        "Compounding Power",
        at,
        reason,
        `${gained} stack${gained === 1 ? "" : "s"}`,
      );
    }
    const resourceTrait = RESOURCE_TRAITS.find((name) =>
      reason.startsWith(name));
    if (resourceTrait && traits.has(resourceTrait)) {
      addTraitProc(
        resourceTrait,
        at,
        reason,
        `+${gained} ${resourceDefinition.singular}`,
      );
    }
    if (
      (
        reason === "Deceptive Evasion"
        || reason === "Self-Deception: Illusionary Ambush"
      )
      && traits.has("Infinite Horizon")
      && state.profession.cloneAmbushUntil >= at - epsilon
    ) {
      onAmbushCreatedClones(at, createdClones);
    }
  };

  const queueResources = (at, count, weapon, reason) => {
    if (scheduleResourceTask) {
      scheduleResourceTask({ at, count, weapon, reason });
      return;
    }
    state.profession.pendingResources.push({ at, count, weapon, reason });
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
