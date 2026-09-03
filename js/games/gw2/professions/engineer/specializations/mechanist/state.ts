import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/types.js';
import type {
  EngineerConfig,
  EngineerMechAttributes,
  EngineerPlayerStats,
  MechanistState
} from '#gw2/professions/engineer/types.js';

// Mechanist owns its public mech projection and the disabled inactive representation.
export const MECHANIST_PUBLIC_END_STATE_KEYS = Object.freeze([
  'mech'
] as const satisfies readonly (keyof MechanistState)[]);

export const MECHANIST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<MechanistState>> = Object.freeze({
  mech: {
    enabled: false,
    active: false,
    commandSkillIds: [],
    nextAttackAt: null,
    busyUntil: 0,
    attributes: null
  }
});

/** Resolves the three mech command skills supplied by the active mechanist traits. */
export function selectedMechCommands(traits: EngineerConfig | ReadonlySet<SkillId>): SkillId[] {
  // Each trait row contributes one command and defaults to its first option
  // when the build does not explicitly select another trait in that row.
  const pick = (groups: readonly (readonly [SkillId, SkillId])[]): SkillId => {
    for (const [traitId, skillId] of groups) {
      if (hasTrait(traits, traitId)) return skillId;
    }

    return groups[0][1];
  };

  return [
    pick([
      [TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, ID.ROLLING_SMASH],
      [TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, ID.EXPLOSIVE_KNUCKLE],
      [TRAIT.MECH_ARMS_JADE_CANNONS, ID.SPARK_REVOLVER]
    ]),
    pick([
      [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, ID.DISCHARGE_ARRAY],
      [TRAIT.MECH_FRAME_CHANNELING_CONDUITS, ID.CRISIS_ZONE],
      [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, ID.CORE_REACTOR_SHOT]
    ]),
    pick([
      [TRAIT.MECH_CORE_JADE_DYNAMO, ID.JADE_MORTAR],
      [TRAIT.MECH_CORE_BARRIER_ENGINE, ID.BARRIER_BURST],
      [TRAIT.MECH_CORE_J_DRIVE, ID.SKY_CIRCUS]
    ])
  ];
}

/** Reads a non-negative player attribute while supplying its baseline when absent. */
function playerAttribute(stats: EngineerPlayerStats, key: keyof EngineerMechAttributes, fallback = 0): number {
  return Math.max(0, Number(stats?.[key] ?? fallback));
}

/** Calculates the jade mech's inherited combat attributes for the selected trait configuration. */
export function engineerMechAttributes(
  config: EngineerConfig = {},
  playerStats: EngineerPlayerStats = {},
  profile?: BalanceProfile
): EngineerMechAttributes {
  const traits = selectedEngineerTraits(config);
  const conductive = hasTrait(traits, TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS);
  const channeling = hasTrait(traits, TRAIT.MECH_FRAME_CHANNELING_CONDUITS);
  const variable = hasTrait(traits, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR);
  // Balance profiles may omit fields, so inheritance always retains a native fallback.
  const profileNumber = (field: string, fallback: number): number => {
    const value = profile?.[field];
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  };

  const baseAttribute = profileNumber('attributeBonus', 1000);
  const inheritanceRatio = profileNumber('attributeConversion', 0.5);
  const secondaryCap = profileNumber('minimumStacks', 750);
  const improvedSecondaryCap = profileNumber('threshold', 1500);
  const improvedInheritanceRatio = profileNumber('coefficientMultiplier', 1);
  // Secondary stats inherit 50 % of the player's value up to 750.
  // Conductive Alloys and Channeling Conduits each double the cap to 1500 and
  // raise the inheritance ratio to 100 % for their respective stat groups.
  const secondary = (key: keyof EngineerMechAttributes, improved = false): number =>
    Math.min(
      improved ? improvedSecondaryCap : secondaryCap,
      playerAttribute(playerStats, key) * (improved ? improvedInheritanceRatio : inheritanceRatio)
    );

  return {
    power: Math.min(
      profileNumber('maximumStacks', 2250),
      baseAttribute + playerAttribute(playerStats, 'power', 1000) * inheritanceRatio
    ),
    precision: variable
      ? Math.min(
          profileNumber('weaponAttributeBonus', 2500),
          profileNumber('basePower', 1) + playerAttribute(playerStats, 'precision', 1000)
        )
      : profileNumber('basePower', 1),
    toughness: baseAttribute + playerAttribute(playerStats, 'toughness', 1000),
    vitality: baseAttribute + playerAttribute(playerStats, 'vitality', 1000),
    ferocity: secondary('ferocity'),
    conditionDamage: secondary('conditionDamage', conductive),
    expertise: secondary('expertise', conductive),
    concentration: secondary('concentration', channeling),
    healingPower: secondary('healingPower', channeling)
  };
}

/** Creates the initial active-mech state, including trait-selected commands and inherited attributes. */
export function createMechanistState(config: EngineerConfig = {}): MechanistState {
  const traits = selectedEngineerTraits(config);
  return {
    mech: {
      enabled: true,
      active: true,
      commandSkillIds: selectedMechCommands(traits),
      nextAttackAt: 1,
      busyUntil: 0,
      attributes: engineerMechAttributes(config, config.stats)
    }
  };
}

export const mechanistState = defineProfessionSpecializationState('Mechanist', createMechanistState);
