import { engineerCatalog } from "./catalog.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "./data/ids.js";

export function selectedEngineerTraits(config = {}) {
  return new Set([
    ...(config.traitIds || []),
    ...(config.selectedTraitIds || []),
    ...(config.selectedTraits || []),
  ].map(value => Number.isFinite(Number(value)) ? Number(value) : value));
}

export function hasEngineerTrait(configOrTraits, traitId) {
  const traits = configOrTraits instanceof Set
    ? configOrTraits
    : selectedEngineerTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}

function skillId(name) {
  return engineerCatalog.skillsByName.get(name)?.id ?? null;
}

function selectedMechCommands(traits) {
  const pick = groups => {
    for (const [traitId, name] of groups) {
      if (hasEngineerTrait(traits, traitId)) return skillId(name);
    }
    return skillId(groups[0][1]);
  };
  return [
    pick([
      [TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, "Rolling Smash"],
      [TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, "Explosive Knuckle"],
      [TRAIT.MECH_ARMS_JADE_CANNONS, "Spark Revolver"],
    ]),
    pick([
      [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, "Discharge Array"],
      [TRAIT.MECH_FRAME_CHANNELING_CONDUITS, "Crisis Zone"],
      [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, "Core Reactor Shot"],
    ]),
    pick([
      [TRAIT.MECH_CORE_JADE_DYNAMO, "Jade Mortar"],
      [TRAIT.MECH_CORE_BARRIER_ENGINE, "Barrier Burst"],
      [TRAIT.MECH_CORE_J_DRIVE, "Sky Circus"],
    ]),
  ].filter(id => id != null);
}

export function createEngineerState(config = {}) {
  const traits = selectedEngineerTraits(config);
  const maximumHeat = hasEngineerTrait(
    traits,
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
  ) ? 150 : 100;
  const specialization = String(config.specialization || "Core");
  return {
    heat: Math.min(maximumHeat, Math.max(0, Number(config.initialHeat || 0))),
    maximumHeat,
    heatUpdatedAt: 0,
    photonForgeActive: false,
    forgeExitedAt: null,
    overheated: false,
    kitLockoutUntil: 0,
    activeKit: "",
    availableFlips: {},
    autoattackChains: {},
    mech: {
      enabled: specialization === "Mechanist",
      active: specialization === "Mechanist",
      commandSkillIds: selectedMechCommands(traits),
      nextAttackAt: specialization === "Mechanist" ? 1 : null,
    },
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    evolvedUntil: 0,
    activeStances: {},
    traitProcReadyAt: {},
  };
}

export function snapshotEngineerState(state) {
  return structuredClone(state);
}

export function projectEngineerEndState({ schedulerState }) {
  const projected = snapshotEngineerState(schedulerState.profession);
  delete projected.traitProcReadyAt;
  return projected;
}

