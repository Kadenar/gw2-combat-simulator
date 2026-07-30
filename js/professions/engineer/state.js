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

export function selectedMechCommands(traits) {
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

export const ENGINEER_MECH_BASE_ATTRIBUTES = Object.freeze({
  power: 1000,
  precision: 1,
  toughness: 1000,
  vitality: 1000,
  ferocity: 0,
  conditionDamage: 0,
  expertise: 0,
  concentration: 0,
  healingPower: 0,
});

function playerAttribute(stats, key, fallback = 0) {
  return Math.max(0, Number(stats?.[key] ?? fallback));
}

/**
 * Resolves the Jade Mech's independent level-80 attributes from the
 * mechanist's current attributes and selected frame trait.
 */
export function engineerMechAttributes(config = {}, playerStats = {}) {
  const traits = selectedEngineerTraits(config);
  const conductive = hasEngineerTrait(
    traits,
    TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
  );
  const channeling = hasEngineerTrait(
    traits,
    TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
  );
  const variable = hasEngineerTrait(
    traits,
    TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
  );
  const secondary = (key, improved = false) => Math.min(
    improved ? 1500 : 750,
    playerAttribute(playerStats, key) * (improved ? 1 : 0.5),
  );

  return {
    power: Math.min(
      2250,
      ENGINEER_MECH_BASE_ATTRIBUTES.power
        + playerAttribute(playerStats, "power", 1000) * 0.5,
    ),
    precision: variable
      ? Math.min(
        2500,
        ENGINEER_MECH_BASE_ATTRIBUTES.precision
          + playerAttribute(playerStats, "precision", 1000),
      )
      : ENGINEER_MECH_BASE_ATTRIBUTES.precision,
    // Mech Fighter is a mandatory Mechanist minor trait.
    toughness:
      ENGINEER_MECH_BASE_ATTRIBUTES.toughness
      + playerAttribute(playerStats, "toughness", 1000),
    vitality:
      ENGINEER_MECH_BASE_ATTRIBUTES.vitality
      + playerAttribute(playerStats, "vitality", 1000),
    ferocity: secondary("ferocity"),
    conditionDamage: secondary("conditionDamage", conductive),
    expertise: secondary("expertise", conductive),
    concentration: secondary("concentration", channeling),
    healingPower: secondary("healingPower", channeling),
  };
}

export function createEngineerState(config = {}) {
  const traits = selectedEngineerTraits(config);
  const maximumHeat = hasEngineerTrait(
    traits,
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
  ) ? 150 : 100;
  const specialization = String(config.specialization || "Core");
  const initialHeat = Math.min(
    maximumHeat,
    Math.max(0, Number(config.initialHeat || 0)),
  );
  return {
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    heat: initialHeat,
    maximumHeat,
    heatUpdatedAt: 0,
    photonForgeActive: false,
    forgeExitedAt: initialHeat > 0 ? 0 : null,
    overheated: false,
    solarFocusingLensStacks: 0,
    solarFocusingLensReadyAt: 0,
    solarFocusingLensUntil: 0,
    enhancedCapacityMightReadyAt: null,
    kitLockoutUntil: 0,
    activeKit: "",
    fireProjectileFinisherProgress: 0,
    completedBlastFinisherActivations: {},
    activeComboFields: [],
    availableFlips: {},
    autoattackChains: {},
    mech: {
      enabled: specialization === "Mechanist",
      active: specialization === "Mechanist",
      commandSkillIds: selectedMechCommands(traits),
      nextAttackAt: specialization === "Mechanist" ? 1 : null,
      busyUntil: 0,
      attributes: specialization === "Mechanist"
        ? engineerMechAttributes(config, config.stats)
        : null,
    },
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    evolvedUntil: 0,
    focusedUntil: 0,
    lightningRodActivationId: "",
    lightningRodChargeExpiries: [],
    electricArtilleryAvailable: false,
    electricArtilleryReadyAt: 0,
    electricArtilleryExpiresAt: 0,
    willingHostUntil: 0,
    plasmaticStateUntil: 0,
    plasmaticLockoutUntil: 0,
    thornsUntil: 0,
    rapaciousUntil: 0,
    predatorUntil: 0,
    titanicUntil: 0,
    berserkerUntil: 0,
    activeStances: {},
    kineticCharges: 0,
    traitProcReadyAt: {},
  };
}

export function snapshotEngineerState(state) {
  return structuredClone(state);
}

export const ENGINEER_PUBLIC_END_STATE_KEYS = Object.freeze([
  "endurance",
  "maximumEndurance",
  "heat",
  "maximumHeat",
  "photonForgeActive",
  "forgeExitedAt",
  "overheated",
  "solarFocusingLensStacks",
  "solarFocusingLensReadyAt",
  "solarFocusingLensUntil",
  "activeKit",
  "availableFlips",
  "autoattackChains",
  "mech",
  "selectedMorphSkillIds",
  "evolvedUntil",
  "focusedUntil",
  "lightningRodChargeExpiries",
  "electricArtilleryAvailable",
  "electricArtilleryReadyAt",
  "electricArtilleryExpiresAt",
  "willingHostUntil",
  "plasmaticStateUntil",
  "plasmaticLockoutUntil",
  "thornsUntil",
  "rapaciousUntil",
  "predatorUntil",
  "titanicUntil",
  "berserkerUntil",
  "activeStances",
  "kineticCharges",
]);

export function projectEngineerEndState({ schedulerState }) {
  const state = schedulerState.profession;
  return Object.fromEntries(
    ENGINEER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key]),
    ]),
  );
}
