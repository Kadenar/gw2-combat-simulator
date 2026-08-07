import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import {
  hasEngineerTrait,
  selectedEngineerTraits,
} from "../../core/state.js";
import type {
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  EngineerConfig,
  EngineerMechAttributes,
  EngineerPlayerStats,
  MechanistState,
} from "../../types.js";

export function selectedMechCommands(
  traits: EngineerConfig | ReadonlySet<SkillId>,
): SkillId[] {
  const pick = (
    groups: readonly (readonly [SkillId, SkillId])[],
  ): SkillId => {
    for (const [traitId, skillId] of groups) {
      if (hasEngineerTrait(traits, traitId)) return skillId;
    }
    return groups[0][1];
  };
  return [
    pick([
      [TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, ID.ROLLING_SMASH],
      [TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, ID.EXPLOSIVE_KNUCKLE],
      [TRAIT.MECH_ARMS_JADE_CANNONS, ID.SPARK_REVOLVER],
    ]),
    pick([
      [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, ID.DISCHARGE_ARRAY],
      [TRAIT.MECH_FRAME_CHANNELING_CONDUITS, ID.CRISIS_ZONE],
      [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, ID.CORE_REACTOR_SHOT],
    ]),
    pick([
      [TRAIT.MECH_CORE_JADE_DYNAMO, ID.JADE_MORTAR],
      [TRAIT.MECH_CORE_BARRIER_ENGINE, ID.BARRIER_BURST],
      [TRAIT.MECH_CORE_J_DRIVE, ID.SKY_CIRCUS],
    ]),
  ];
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

function playerAttribute(
  stats: EngineerPlayerStats,
  key: keyof EngineerMechAttributes,
  fallback = 0,
): number {
  return Math.max(0, Number(stats?.[key] ?? fallback));
}

export function engineerMechAttributes(
  config: EngineerConfig = {},
  playerStats: EngineerPlayerStats = {},
): EngineerMechAttributes {
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
  const secondary = (
    key: keyof EngineerMechAttributes,
    improved = false,
  ): number =>
    Math.min(
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

export function createMechanistState(
  config: EngineerConfig = {},
): MechanistState {
  const traits = selectedEngineerTraits(config);
  return {
    mech: {
      enabled: true,
      active: true,
      commandSkillIds: selectedMechCommands(traits),
      nextAttackAt: 1,
      busyUntil: 0,
      attributes: engineerMechAttributes(config, config.stats),
    },
  };
}

export const mechanistState = defineProfessionSpecializationState(
  "Mechanist",
  createMechanistState,
);
